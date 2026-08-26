import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createVotesActor } from "../votes.js";
import { attachmentToUrl } from "../chat.js";
import Lightbox from "../components/Lightbox.jsx";
import StyledUserName from "../components/StyledUserName.jsx";
import { createShopActor } from "../shopApi.js";
import ShareToChatButton from "../components/ShareToChatButton.jsx";

export default function VoteDetail() {
  const { pollId } = useParams();
  const navigate = useNavigate();
  const { identity, profile } = useAuth();
  const isAdmin = profile && "admin" in profile.role;
  const [votesActor, setVotesActor] = useState(null);
  const [poll, setPoll] = useState(null);
  const [counts, setCounts] = useState([]);
  const [voted, setVoted] = useState(false);
  const [comments, setComments] = useState([]);
  const [myPollLove, setMyPollLove] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [myShopProfile, setMyShopProfile] = useState(null);
  const numericPollId = Number(pollId);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const v = await createVotesActor(identity);
      setVotesActor(v);
      try {
        const s = await createShopActor(identity);
        const sp = await s.getMyShopProfile();
        setMyShopProfile(sp);
      } catch (e) {}
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!votesActor) return;
    try {
      const [p, c, hv, cm, loved] = await Promise.all([
        votesActor.getPoll(numericPollId),
        votesActor.getResults(numericPollId),
        votesActor.hasVoted(numericPollId),
        votesActor.getComments(numericPollId),
        votesActor.getMyPollLoveGiven(numericPollId),
      ]);
      setPoll(p.length > 0 ? p[0] : null);
      setCounts(c);
      setVoted(hv);
      setComments(cm);
      setMyPollLove(loved);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [votesActor, numericPollId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const total = counts.reduce((sum, c) => sum + Number(c), 0);

  const handleVote = async (optionIndex) => {
    if (!votesActor) return;
    setError(null);
    try {
      const ok = await votesActor.vote(numericPollId, optionIndex);
      if (!ok) setError("Could not record your vote (maybe you already voted).");
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleDelete = async () => {
    if (!votesActor) return;
    if (!window.confirm("Delete this poll? This can\'t be undone.")) return;
    setError(null);
    try {
      await votesActor.deletePoll(numericPollId);
      navigate("/votes");
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleLovePoll = async () => {
    if (!votesActor) return;
    setError(null);
    try {
      const ok = await votesActor.loveThisPoll(numericPollId);
      if (!ok) setError("Could not send Love (maybe you don't have any, or already sent it here).");
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleLoveComment = async (commentId) => {
    if (!votesActor) return;
    setError(null);
    try {
      const ok = await votesActor.loveThisPollComment(commentId);
      if (!ok) setError("Could not send Love (maybe you don't have any, or already sent it here).");
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleReactComment = async (commentId, isThumbsUp) => {
    if (!votesActor) return;
    setError(null);
    try {
      await votesActor.reactToComment(commentId, isThumbsUp);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!votesActor) return;
    setError(null);
    try {
      await votesActor.deleteComment(commentId);
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const commentingRef = useRef(false);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!votesActor || !commentText.trim()) return;
    if (commentingRef.current) return;
    commentingRef.current = true;
    setError(null);
    try {
      await votesActor.addComment(numericPollId, commentText.trim());
      setCommentText("");
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    } finally {
      commentingRef.current = false;
    }
  };

  if (!poll) return <p className="chat-empty">Loading...</p>;

  const coverUrl = poll.coverPhoto.length > 0 ? attachmentToUrl(poll.coverPhoto[0]) : null;

  return (
    <div>
      {coverUrl && (
        <div className="event-cover-wrap">
          <img
            src={coverUrl}
            alt={poll.title}
            className="zoomable-image event-cover-image"
            onClick={() => setLightboxSrc(coverUrl)}
          />
        </div>
      )}

      <h1 className="page-title">{poll.title}</h1>
      {poll.description && <p className="page-subtitle">{poll.description}</p>}
      <p className="tree-rel">by {poll.creatorName}</p>
      <div style={{ marginBottom: 12 }}>
        <ShareToChatButton
          shareType="vote"
          shareTitle={"Vote: " + poll.title}
          shareLink={"/votes/" + pollId}
          compact
        />
      </div>
      {profile && (poll.creator.toString() === profile.id.toString() || isAdmin) && (
        <button className="tree-remove-btn" style={{ marginBottom: 12 }} onClick={handleDelete}>
          {poll.creator.toString() === profile.id.toString() ? "Delete poll" : "Delete poll (admin)"}
        </button>
      )}
      {profile && poll.creator.toString() !== profile.id.toString() && (
        myPollLove ? (
          <p className="tree-rel" style={{ marginBottom: 12 }}>💗 Love sent</p>
        ) : (
          <button
            className="chat-send-button"
            style={{ marginBottom: 12, padding: "4px 10px", fontSize: 12, background: "#e0558f" }}
            onClick={handleLovePoll}
          >
            💗 Love this poll (1)
          </button>
        )
      )}

      <div className="tree-admin-panel">
        {poll.options.map((opt, i) => {
          const c = Number(counts[i] || 0);
          const pct = total > 0 ? Math.round((c / total) * 100) : 0;
          const optionUser = poll.optionUsers[i];
          const isSelf = optionUser.length > 0 && profile && optionUser[0].toString() === profile.id.toString();
          return (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span>{opt}</span>
                <span>{pct}% ({c})</span>
              </div>
              <div style={{ background: "var(--off-white)", borderRadius: 8, height: 10, overflow: "hidden" }}>
                <div style={{ width: pct + "%", background: "var(--orange)", height: "100%" }} />
              </div>
              {!voted && !isSelf && (
                <button className="chat-send-button" style={{ marginTop: 6 }} onClick={() => handleVote(i)}>
                  Vote {opt}
                </button>
              )}
              {!voted && isSelf && (
                <p className="tree-rel" style={{ marginTop: 6 }}>That's you — you can't vote for yourself.</p>
              )}
            </div>
          );
        })}
        {voted && <p className="tree-rel">You've already voted on this poll.</p>}
      </div>

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Comments</h2>
      <div className="chat-window" style={{ height: "auto", minHeight: 100 }}>
        {comments.length === 0 && <p className="chat-empty">No comments yet.</p>}
        {comments.map((c) => (
          <div key={c.id.toString()} className="chat-message">
            <div className="chat-message-sender">
              <Link to={"/profile/" + c.author.toString()}>
                <StyledUserName
                  userId={c.author}
                  name={c.authorName}
                  isMe={profile && c.author.toString() === profile.id.toString()}
                  myShopProfile={myShopProfile}
                />
              </Link>
            </div>
            <div className="chat-message-text">{c.text}</div>
            <div className="tree-rel" style={{ marginTop: 4 }}>
              👎 {c.thumbsDownCount.toString()}
            </div>
            {profile && c.author.toString() !== profile.id.toString() && (
              c.myReaction.length > 0 ? (
                <span className="tree-rel">You reacted: {c.myReaction[0] ? "👍" : "👎"}</span>
              ) : (
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button className="chat-send-button" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => handleReactComment(c.id, true)}>
                    👍
                  </button>
                  <button className="chat-send-button" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => handleReactComment(c.id, false)}>
                    👎
                  </button>
                </div>
              )
            )}
            {profile && c.author.toString() !== profile.id.toString() && (
              c.myLoveGiven ? (
                <span className="tree-rel" style={{ marginLeft: 8 }}>💗 sent</span>
              ) : (
                <button className="chat-send-button" style={{ padding: "2px 8px", fontSize: 12, marginLeft: 6, background: "#e0558f" }} onClick={() => handleLoveComment(c.id)}>
                  💗
                </button>
              )
            )}
            {profile && (c.author.toString() === profile.id.toString() || isAdmin) && (
              <button className="delete-x-btn" onClick={() => handleDeleteComment(c.id)} title={c.author.toString() === profile.id.toString() ? "Delete" : "Delete (admin)"}>
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <form className="chat-input-row" onSubmit={handleComment} style={{ marginTop: 10 }}>
        <textarea
          className="chat-text-input"
          rows={1}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleComment(e);
            }
          }}
        />
        <button className="chat-send-button" type="submit">Post</button>
      </form>

      {error && <p className="auth-error">{error}</p>}

      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
