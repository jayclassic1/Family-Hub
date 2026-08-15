import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createAuthActor } from "../auth.js";
import { createVotesActor, topResult } from "../votes.js";
import { fileToAttachment, attachmentToUrl, MAX_UPLOAD_BYTES } from "../chat.js";

const IMAGE_TYPES = ["image/png", "image/jpeg"];

export default function Votes() {
  const { identity, profile } = useAuth();
  const [votesActor, setVotesActor] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pollType, setPollType] = useState("yesno");
  const [customOptions, setCustomOptions] = useState(["", ""]);
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [coverFile, setCoverFile] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const v = await createVotesActor(identity);
      const a = await createAuthActor(identity);
      setVotesActor(v);
      const users = await a.getAllUsers();
      setAllUsers(users);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!votesActor) return;
    try {
      const result = await votesActor.listPollsWithResults();
      setSummaries(result);
    } catch (e) {
      setError(String(e));
    }
  }, [votesActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleLovePoll = async (e, pollId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!votesActor) return;
    setError(null);
    try {
      const ok = await votesActor.loveThisPoll(pollId);
      if (!ok) setError("Could not send Love (maybe you don't have any, or already sent it here).");
      await refresh();
    } catch (e2) {
      setError(String(e2));
    }
  };

  const handleOptionChange = (i, value) => {
    const next = [...customOptions];
    next[i] = value;
    setCustomOptions(next);
  };

  const addOptionField = () => {
    if (customOptions.length >= 8) return;
    setCustomOptions([...customOptions, ""]);
  };

  const removeOptionField = (i) => {
    if (customOptions.length <= 2) return;
    setCustomOptions(customOptions.filter((_, idx) => idx !== i));
  };

  const togglePerson = (idText) => {
    setSelectedPeople((prev) => {
      if (prev.includes(idText)) return prev.filter((x) => x !== idText);
      if (prev.length >= 8) return prev;
      return [...prev, idText];
    });
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
      setError("Photo is too large (max ~1.7MB).");
      e.target.value = "";
      return;
    }
    setError(null);
    setCoverFile(f);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!votesActor || !title.trim()) return;
    setError(null);
    try {
      let options = [];
      let optionUsers = [];

      if (pollType === "yesno") {
        options = ["Yes", "No"];
        optionUsers = [[], []];
      } else if (pollType === "custom") {
        options = customOptions.map((o) => o.trim()).filter(Boolean);
        optionUsers = options.map(() => []);
      } else {
        const chosen = allUsers.filter((u) => selectedPeople.includes(u.id.toString()));
        options = chosen.map((u) => u.username);
        optionUsers = chosen.map((u) => [u.id]);
      }

      if (options.length < 2) {
        setError(pollType === "people" ? "Select at least 2 people." : "Add at least 2 options.");
        return;
      }

      let coverPhoto = [];
      if (coverFile) {
        const attachment = await fileToAttachment(coverFile);
        coverPhoto = [attachment];
      }
      await votesActor.createPoll(title.trim(), description.trim(), options, optionUsers, coverPhoto);
      setTitle("");
      setDescription("");
      setCustomOptions(["", ""]);
      setSelectedPeople([]);
      setPollType("yesno");
      setCoverFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
    } catch (e2) {
      setError(String(e2));
    }
  };

  const otherPeople = allUsers.filter((u) => !profile || u.id.toString() !== profile.id.toString());

  return (
    <div>
      <h1 className="page-title">Votes</h1>
      <p className="page-subtitle">Create a poll, everyone gets one anonymous vote.</p>

      <h2 className="tree-admin-title">All polls</h2>
      <div className="card-grid tree-grid">
        {summaries.map(({ poll, counts, myLoveGiven }) => {
          const top = topResult(poll, counts);
          const isOwn = profile && poll.creator.toString() === profile.id.toString();
          return (
            <Link key={poll.id.toString()} to={"/votes/" + poll.id.toString()} className="card tree-card">
              {poll.coverPhoto.length > 0 && (
                <img src={attachmentToUrl(poll.coverPhoto[0])} alt={poll.title} className="event-card-thumb" />
              )}
              <div className="card-title">{poll.title}</div>
              <div className="card-description">
                {top.total > 0 ? `${top.label} — ${top.pct}%` : "No votes yet"}
              </div>
              <div className="tree-rel">by {poll.creatorName}</div>
              {!isOwn && (
                myLoveGiven ? (
                  <p className="tree-rel" style={{ marginTop: 6 }}>💗 Love sent</p>
                ) : (
                  <button
                    className="chat-send-button"
                    style={{ marginTop: 6, padding: "4px 10px", fontSize: 12, background: "#e0558f" }}
                    onClick={(e) => handleLovePoll(e, poll.id)}
                  >
                    💗 Love (1)
                  </button>
                )
              )}
            </Link>
          );
        })}
        {summaries.length === 0 && <p className="chat-empty">No polls yet — create the first one!</p>}
      </div>

      <div className="tree-admin-panel" style={{ marginTop: 24 }}>
        <h2 className="tree-admin-title">Create a poll</h2>
        <form onSubmit={handleCreate}>
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            placeholder="Poll question"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div style={{ marginBottom: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label>
              <input
                type="radio"
                checked={pollType === "yesno"}
                onChange={() => setPollType("yesno")}
              />{" "}
              Yes / No
            </label>
            <label>
              <input
                type="radio"
                checked={pollType === "custom"}
                onChange={() => setPollType("custom")}
              />{" "}
              Custom options (2-8)
            </label>
            <label>
              <input
                type="radio"
                checked={pollType === "people"}
                onChange={() => setPollType("people")}
              />{" "}
              Vote on a person (2-8)
            </label>
          </div>
          {pollType === "custom" && (
            <div style={{ marginBottom: 10 }}>
              {customOptions.map((opt, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <input
                    className="chat-text-input"
                    placeholder={"Option " + (i + 1)}
                    value={opt}
                    onChange={(e) => handleOptionChange(i, e.target.value)}
                  />
                  {customOptions.length > 2 && (
                    <button type="button" className="tree-remove-btn" onClick={() => removeOptionField(i)}>Remove</button>
                  )}
                </div>
              ))}
              {customOptions.length < 8 && (
                <button type="button" className="nav-logout" style={{ background: "var(--yellow)", color: "var(--text-dark)" }} onClick={addOptionField}>
                  Add option
                </button>
              )}
            </div>
          )}
          {pollType === "people" && (
            <div style={{ marginBottom: 10 }}>
              <p className="tree-rel" style={{ marginBottom: 8 }}>
                Pick 2-8 people. Nobody can vote for themselves.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {allUsers.map((u) => (
                  <label key={u.id.toString()} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="checkbox"
                      checked={selectedPeople.includes(u.id.toString())}
                      onChange={() => togglePerson(u.id.toString())}
                    />
                    {u.username}{profile && u.id.toString() === profile.id.toString() ? " (you)" : ""}
                  </label>
                ))}
                {allUsers.length === 0 && <p className="tree-rel">No family members registered yet.</p>}
              </div>
            </div>
          )}
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>Cover photo (optional)</label>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" onChange={handleCoverChange} />
            {coverFile && <div className="tree-rel" style={{ marginTop: 6 }}>Photo: {coverFile.name}</div>}
          </div>
          <button className="chat-send-button" type="submit">Create poll</button>
        </form>
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
