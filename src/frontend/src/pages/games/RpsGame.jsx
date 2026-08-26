import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { createRpsActor, CHOICE_EMOJI, choiceKey, statusKey } from "../../rpsApi.js";
import { fileToAttachment, attachmentToUrl, MAX_UPLOAD_BYTES } from "../../chat.js";
import Lightbox from "../../components/Lightbox.jsx";

const IMAGE_TYPES = ["image/png", "image/jpeg"];
const CHOICES = ["rock", "paper", "scissors"];

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playNote(freq, startOffset, duration) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    const start = ctx.currentTime + startOffset;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  } catch (e) {}
}
function playClash() {
  [300, 300, 300, 500].forEach((f, i) => playNote(f, i * 0.3, 0.25));
}

export default function RpsGame() {
  const { gameId } = useParams();
  const { identity, profile } = useAuth();
  const [rpsActor, setRpsActor] = useState(null);
  const [game, setGame] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState(null);
  const [showImportantForm, setShowImportantForm] = useState(false);
  const [gameName, setGameName] = useState("");
  const [gameDescription, setGameDescription] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [prevStatus, setPrevStatus] = useState(null);
  const numericGameId = Number(gameId);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const r = await createRpsActor(identity);
      setRpsActor(r);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!rpsActor) return;
    try {
      const [g, mine, cm] = await Promise.all([
        rpsActor.getGame(numericGameId),
        rpsActor.getMyChoice(numericGameId),
        rpsActor.getComments(numericGameId),
      ]);
      if (g.length > 0) {
        const newGame = g[0];
        const newStatus = statusKey(newGame.status);
        if (prevStatus === "waitingForChoices" && newStatus === "finished") {
          playClash();
        }
        setPrevStatus(newStatus);
        setGame(newGame);
      }
      setMyChoice(mine.length > 0 ? Object.keys(mine[0])[0] : null);
      setComments(cm);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [rpsActor, numericGameId, prevStatus]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (!game) return <p className="chat-empty">Loading...</p>;

  const meText = profile ? profile.id.toString() : null;
  const isCreator = meText && game.creator.toString() === meText;
  const isOpponent = meText && game.opponent.length > 0 && game.opponent[0].toString() === meText;
  const isParticipant = isCreator || isOpponent;
  const status = statusKey(game.status);

  const handleConfirmJoin = async () => {
    if (!rpsActor) return;
    setError(null);
    try {
      await rpsActor.confirmJoin(numericGameId);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleChoice = async (choice) => {
    if (!rpsActor || myChoice) return;
    setError(null);
    try {
      await rpsActor.makeChoice(numericGameId, { [choice]: null });
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handlePlayAgain = async () => {
    if (!rpsActor) return;
    setError(null);
    setShowImportantForm(false);
    try {
      await rpsActor.playAgain(numericGameId);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleCoverChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type)) {
      setError("Cover photo must be a PNG or JPG.");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setError("Photo is too large (max ~3.3MB).");
      e.target.value = "";
      return;
    }
    setError(null);
    setCoverFile(f);
  };

  const handleSaveImportant = async (e) => {
    e.preventDefault();
    if (!rpsActor || !gameName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let coverPhoto = [];
      if (coverFile) {
        const attachment = await fileToAttachment(coverFile);
        coverPhoto = [attachment];
      }
      await rpsActor.markImportant(numericGameId, gameName.trim(), gameDescription.trim(), coverPhoto);
      setShowImportantForm(false);
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const commentingRef = useRef(false);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!rpsActor || !commentText.trim()) return;
    if (commentingRef.current) return;
    commentingRef.current = true;
    setError(null);
    try {
      await rpsActor.addComment(numericGameId, commentText.trim());
      setCommentText("");
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      commentingRef.current = false;
    }
  };

  const cKey = choiceKey(game.creatorChoice);
  const oKey = choiceKey(game.opponentChoice);
  const coverUrl = game.coverPhoto.length > 0 ? attachmentToUrl(game.coverPhoto[0]) : null;

  return (
    <div>
      <Link to="/games/rock-paper-scissors" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Rock Paper Scissors
      </Link>

      {coverUrl && (
        <div className="event-cover-wrap">
          <img src={coverUrl} alt={game.name[0]} className="zoomable-image event-cover-image" onClick={() => setLightboxSrc(coverUrl)} />
        </div>
      )}

      <h1 className="page-title">
        {game.name.length > 0 ? game.name[0] : game.creatorName + " vs " + (game.opponentName.length > 0 ? game.opponentName[0] : "?")}
      </h1>
      {game.description.length > 0 && game.description[0] && <p className="page-subtitle">{game.description[0]}</p>}
      <p className="tree-rel">{game.creatorName} vs {game.opponentName.length > 0 ? game.opponentName[0] : "waiting..."} — Round {game.round.toString()}</p>

      {status === "waitingForOpponent" && isOpponent && (
        <div className="tree-admin-panel" style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 10px" }}>{game.creatorName} challenged you to Rock Paper Scissors!</p>
          <button className="chat-send-button" onClick={handleConfirmJoin}>Accept Challenge</button>
        </div>
      )}

      {status === "waitingForOpponent" && !isOpponent && (
        <p className="tree-rel">Waiting for {game.opponentName.length > 0 ? game.opponentName[0] : "the invited player"} to accept...</p>
      )}

      {status === "waitingForChoices" && (
        <div className="tree-admin-panel">
          {isParticipant ? (
            myChoice ? (
              <p style={{ margin: 0 }}>You picked {CHOICE_EMOJI[myChoice]}. Waiting for the other player...</p>
            ) : (
              <>
                <p style={{ marginBottom: 10 }}>Make your choice:</p>
                <div style={{ display: "flex", gap: 10 }}>
                  {CHOICES.map((c) => (
                    <button key={c} className="chat-send-button rps-choice-button" onClick={() => handleChoice(c)}>
                      <span style={{ fontSize: 28 }}>{CHOICE_EMOJI[c]}</span>
                    </button>
                  ))}
                </div>
              </>
            )
          ) : (
            <p style={{ margin: 0 }}>Both players are choosing...</p>
          )}
        </div>
      )}

      {status === "finished" && (
        <div className="tree-admin-panel">
          <div className="rps-reveal">
            <div className="rps-reveal-side">
              <div className="tree-rel">{game.creatorName}</div>
              <div style={{ fontSize: 48 }}>{cKey ? CHOICE_EMOJI[cKey] : "?"}</div>
            </div>
            <div className="rps-reveal-vs">vs</div>
            <div className="rps-reveal-side">
              <div className="tree-rel">{game.opponentName.length > 0 ? game.opponentName[0] : "?"}</div>
              <div style={{ fontSize: 48 }}>{oKey ? CHOICE_EMOJI[oKey] : "?"}</div>
            </div>
          </div>
          <div className="coin-toss-result" style={{ marginTop: 14 }}>
            {game.isDraw ? "It's a tie!" : "🎉 " + (game.winnerName.length > 0 ? game.winnerName[0] : "?") + " wins!"}
          </div>
          {isParticipant && (
            <button className="chat-send-button" style={{ marginTop: 14 }} onClick={handlePlayAgain}>
              Play Again
            </button>
          )}

          {isParticipant && game.name.length === 0 && (
            <div style={{ marginTop: 14 }}>
              {!showImportantForm ? (
                <button className="chat-send-button" onClick={() => setShowImportantForm(true)}>
                  Mark as important game
                </button>
              ) : (
                <form onSubmit={handleSaveImportant} style={{ marginTop: 10 }}>
                  <input
                    className="chat-text-input"
                    style={{ width: "100%", marginBottom: 10 }}
                    placeholder="Game name"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    autoFocus
                  />
                  <textarea
                    className="chat-text-input"
                    style={{ width: "100%", marginBottom: 10, minHeight: 50, resize: "vertical" }}
                    placeholder="Description (optional)"
                    value={gameDescription}
                    onChange={(e) => setGameDescription(e.target.value)}
                  />
                  <div style={{ marginBottom: 10 }}>
                    <input type="file" accept="image/png,image/jpeg" onChange={handleCoverChange} />
                    {coverFile && <div className="tree-rel" style={{ marginTop: 6 }}>Photo: {coverFile.name}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="tree-remove-btn" onClick={() => setShowImportantForm(false)} disabled={saving}>Cancel</button>
                    <button className="chat-send-button" type="submit" disabled={saving || !gameName.trim()}>
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Comments</h2>
      <div className="chat-window" style={{ height: "auto", minHeight: 100 }}>
        {comments.length === 0 && <p className="chat-empty">No comments yet.</p>}
        {comments.map((c) => (
          <div key={c.id.toString()} className="chat-message">
            <div className="chat-message-sender">
              <Link to={"/profile/" + c.author.toString()}>{c.authorName}</Link>
            </div>
            <div className="chat-message-text">{c.text}</div>
          </div>
        ))}
      </div>
      <form className="chat-input-row" onSubmit={handleComment} style={{ marginTop: 10 }}>
        <textarea className="chat-text-input" rows={1} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment..." onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(e); } }} />
        <button className="chat-send-button" type="submit">Post</button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
