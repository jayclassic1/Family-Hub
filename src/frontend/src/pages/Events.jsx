import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createEventsActor, eventOccursOnDate, getUpcomingEvents, getMonthGrid, formatEventKind } from "../events.js";
import { createAuthActor } from "../auth.js";
import { attachmentToUrl, fileToAttachment, MAX_UPLOAD_BYTES } from "../chat.js";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_THEME = ["❄️","💘","🌱","🌷","🌸","☀️","🎆","🏖️","🍂","🎃","🦃","🎄"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const IMAGE_TYPES = ["image/png", "image/jpeg"];

function isSameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function Events() {
  const navigate = useNavigate();
  const { identity, profile } = useAuth();
  const [eventsActor, setEventsActor] = useState(null);
  const [authActor, setAuthActor] = useState(null);
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(null);
  const [error, setError] = useState(null);
  const [rsvpMap, setRsvpMap] = useState({});

  const [detailedTitle, setDetailedTitle] = useState("");
  const [detailedDescription, setDetailedDescription] = useState("");
  const [dateMode, setDateMode] = useState("oneTime");
  const [oneTimeDate, setOneTimeDate] = useState("");
  const [annualMonth, setAnnualMonth] = useState("1");
  const [annualDay, setAnnualDay] = useState("1");
  const [visibility, setVisibility] = useState("everyone");
  const [allowRsvp, setAllowRsvp] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [detailedCoverPhoto, setDetailedCoverPhoto] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [modalDate, setModalDate] = useState(null);
  const [showQuickAddForm, setShowQuickAddForm] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickTime, setQuickTime] = useState("12:00");
  const [quickDescription, setQuickDescription] = useState("");
  const [quickCoverPhoto, setQuickCoverPhoto] = useState(null);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState(null);

  useEffect(() => {
    if (!identity) return;
    (async () => {
      const ea = await createEventsActor(identity);
      const aa = await createAuthActor(identity);
      setEventsActor(ea);
      setAuthActor(aa);
      const allUsers = await aa.getAllUsers();
      setUsers(allUsers);
    })();
  }, [identity]);

  const refresh = useCallback(async () => {
    if (!eventsActor) return;
    try {
      const result = await eventsActor.getVisibleEvents();
      setEvents(result);
      const rmap = {};
      for (const ev of result) {
        const mine = await eventsActor.getMyRsvp(ev.id);
        if (mine.length > 0) rmap[ev.id.toString()] = Object.keys(mine[0])[0];
      }
      setRsvpMap(rmap);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [eventsActor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const year = viewDate.getFullYear();
  const monthIndex0 = viewDate.getMonth();
  const monthGrid = getMonthGrid(year, monthIndex0);
  const eventsOnDate = (date) => (date ? events.filter((ev) => eventOccursOnDate(ev, date)) : []);
  const upcoming = getUpcomingEvents(events, new Date(), 10);

  const handlePrevMonth = () => setViewDate(new Date(year, monthIndex0 - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(year, monthIndex0 + 1, 1));
  const handleToday = () => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  };

  const toggleSelectedUser = (id) => {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleDayClick = (date) => {
    setSelectedDate(date);
    setModalDate(date);
    setShowQuickAddForm(false);
    setQuickTitle("");
    setQuickTime("12:00");
    setQuickDescription("");
    setQuickCoverPhoto(null);
    setQuickError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalDate(null);
    setShowQuickAddForm(false);
    setQuickError(null);
  };

  const goToEvent = (id) => {
    navigate("/events/" + id.toString());
  };

  const validatePhoto = (file) => {
    if (!IMAGE_TYPES.includes(file.type)) return "Cover photo must be a PNG or JPG.";
    if (file.size > MAX_UPLOAD_BYTES) return "Photo is too large (max ~3.3MB).";
    return null;
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!eventsActor || !modalDate || !quickTitle.trim()) return;
    setQuickSaving(true);
    setQuickError(null);
    try {
      const [hh, mm] = quickTime.split(":").map(Number);
      const when = new Date(modalDate.getFullYear(), modalDate.getMonth(), modalDate.getDate(), hh || 0, mm || 0);
      const kind = { oneTime: { dateMillis: BigInt(when.getTime()) } };
      const vis = { everyone: null };
      let cover = [];
      if (quickCoverPhoto) cover = [await fileToAttachment(quickCoverPhoto)];
      await eventsActor.createEvent(quickTitle.trim(), quickDescription.trim(), kind, vis, cover);
      await refresh();
      closeModal();
    } catch (e2) {
      setQuickError("Something went wrong. Please try again.");
    } finally {
      setQuickSaving(false);
    }
  };

  const handleQuickPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validatePhoto(file);
    if (err) {
      setQuickError("Something went wrong. Please try again.");
      e.target.value = "";
      return;
    }
    setQuickError(null);
    setQuickCoverPhoto(file);
  };

  const handleDetailedAdd = async (e) => {
    e.preventDefault();
    if (!eventsActor || !detailedTitle.trim()) return;
    setError(null);
    try {
      let kind;
      if (dateMode === "oneTime") {
        if (!oneTimeDate) {
          setError("Pick a date for a one-time event.");
          return;
        }
        const ms = new Date(oneTimeDate).getTime();
        kind = { oneTime: { dateMillis: BigInt(ms) } };
      } else {
        kind = { annual: { month: Number(annualMonth), day: Number(annualDay) } };
      }
      const vis =
        visibility === "everyone"
          ? { everyone: null }
          : { selected: selectedUserIds.map((id) => users.find((u) => u.id.toString() === id).id) };
      let cover = [];
      if (detailedCoverPhoto) cover = [await fileToAttachment(detailedCoverPhoto)];
      await eventsActor.createEvent(detailedTitle.trim(), detailedDescription.trim(), kind, vis, cover, allowRsvp);
      setDetailedTitle("");
      setDetailedDescription("");
      setOneTimeDate("");
      setSelectedUserIds([]);
      setVisibility("everyone");
      setAllowRsvp(false);
      setDetailedCoverPhoto(null);
      await refresh();
    } catch (e2) {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleDetailedPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validatePhoto(file);
    if (err) {
      setError("Something went wrong. Please try again.");
      e.target.value = "";
      return;
    }
    setError(null);
    setDetailedCoverPhoto(file);
  };

  const handleRsvp = async (eventId, response) => {
    if (!eventsActor) return;
    setError(null);
    try {
      await eventsActor.rsvp(eventId, { [response]: null });
      await refresh();
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  const eventsForSelectedDate = modalDate ? eventsOnDate(modalDate) : [];

  return (
    <div>
      <h1 className="page-title">Events</h1>

      <div className="tree-admin-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <button className="chat-send-button" onClick={handlePrevMonth}>&lt; Prev</button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="tree-admin-title" style={{ margin: 0 }}>{MONTH_THEME[monthIndex0]} {MONTH_NAMES[monthIndex0]} {year}</div>
            <button
              className="chat-send-button"
              style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={handleToday}
            >
              Today
            </button>
          </div>
          <button className="chat-send-button" onClick={handleNextMonth}>Next &gt;</button>
        </div>
        <div className="calendar-grid">
          {DAY_NAMES.map((d) => (
            <div key={d} className="calendar-weekday">{d}</div>
          ))}
          {monthGrid.flat().map((date, i) => {
            const dayEvents = eventsOnDate(date);
            const isSelected = selectedDate && date && isSameDay(selectedDate, date);
            const isToday = date && isSameDay(today, date);
            return (
              <div
                key={i}
                className={
                  "calendar-cell" +
                  (date ? " calendar-cell-active" : "") +
                  (isSelected ? " calendar-cell-selected" : "") +
                  (isToday ? " calendar-cell-today" : "") +
                  (dayEvents.length > 0 ? " calendar-cell-has-event" : "") +
                  (dayEvents.length > 0 && isToday ? " calendar-cell-event-today" : "")
                }
                title={dayEvents.length > 0 ? dayEvents.map((e) => e.title).join(", ") : undefined}
                onClick={() => date && handleDayClick(date)}
              >
                {dayEvents.length > 0 && (
                  <div className="calendar-event-label">
                    {dayEvents.map((e) => e.title).join(", ")}
                  </div>
                )}
                {date && <div className="calendar-day-num">{date.getDate()}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {showModal && modalDate && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2 className="tree-admin-title" style={{ marginTop: 0 }}>
              {modalDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </h2>
            {!showQuickAddForm ? (
              <>
                {eventsForSelectedDate.length === 0 ? (
                  <p className="chat-empty" style={{ padding: "12px 0" }}>No events on this day.</p>
                ) : (
                  <div style={{ marginBottom: 14 }}>
                    {eventsForSelectedDate.map((ev) => (
                      <div
                        key={ev.id.toString()}
                        className="chat-message"
                        style={{ marginBottom: 10, cursor: "pointer", overflow: "hidden" }}
                        onClick={() => {
                          closeModal();
                          goToEvent(ev.id);
                        }}
                      >
                        {ev.coverPhoto.length > 0 && (
                          <img src={attachmentToUrl(ev.coverPhoto[0])} alt={ev.title} className="event-modal-thumb" />
                        )}
                        <div className="chat-message-sender">{ev.title}</div>
                        {ev.description && <div className="chat-message-text">{ev.description}</div>}
                        <div className="tree-rel">by {ev.creatorName} &mdash; {formatEventKind(ev)}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" className="tree-remove-btn" onClick={closeModal}>Close</button>
                  <button type="button" className="chat-send-button" onClick={() => setShowQuickAddForm(true)}>
                    + Add event
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleQuickAdd}>
                <input
                  className="chat-text-input"
                  style={{ width: "100%", marginBottom: 10 }}
                  placeholder="Event name"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  autoFocus
                />
                <input
                  type="time"
                  className="chat-text-input"
                  style={{ width: "100%", marginBottom: 10 }}
                  value={quickTime}
                  onChange={(e) => setQuickTime(e.target.value)}
                />
                <textarea
                  className="chat-text-input"
                  style={{ width: "100%", marginBottom: 10, minHeight: 70, resize: "vertical" }}
                  placeholder="Details (optional)"
                  value={quickDescription}
                  onChange={(e) => setQuickDescription(e.target.value)}
                />
                <input type="file" accept="image/png,image/jpeg" onChange={handleQuickPhotoChange} style={{ marginBottom: 10 }} />
                {quickCoverPhoto && (
                  <div className="tree-rel" style={{ marginBottom: 10 }}>Photo: {quickCoverPhoto.name}</div>
                )}
                {quickError && <p className="auth-error">{quickError}</p>}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" className="tree-remove-btn" onClick={() => setShowQuickAddForm(false)} disabled={quickSaving}>
                    Back
                  </button>
                  <button className="chat-send-button" type="submit" disabled={quickSaving || !quickTitle.trim()}>
                    {quickSaving ? "Saving..." : "Add event"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <h2 className="tree-admin-title" style={{ marginTop: 24 }}>Upcoming</h2>
      <div className="card-grid tree-grid">
        {upcoming.map(({ event: ev }) => (
          <div key={ev.id.toString()} className="card tree-card" style={{ cursor: "pointer" }} onClick={() => goToEvent(ev.id)}>
            {ev.coverPhoto.length > 0 && (
              <img src={attachmentToUrl(ev.coverPhoto[0])} alt={ev.title} className="event-card-thumb" />
            )}
            <div className="card-title">{ev.title}</div>
            <div className="card-description">{formatEventKind(ev)}</div>
            {ev.allowRsvp && (
              <>
                <div className="tree-rel" style={{ marginTop: 8 }}>Want to go?</div>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  {["yes", "maybe", "no"].map((r) => (
                    <button
                      key={r}
                      className="chat-send-button"
                      style={{
                        padding: "4px 10px",
                        fontSize: 12,
                        background: rsvpMap[ev.id.toString()] === r ? "var(--orange-dark)" : "var(--orange)",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRsvp(ev.id, r);
                      }}
                    >
                      {r === "yes" ? "Yes" : r === "no" ? "No" : "Maybe"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
        {upcoming.length === 0 && <p className="chat-empty">No upcoming events yet.</p>}
      </div>

      <div className="tree-admin-panel" style={{ marginTop: 24 }}>
        <h2 className="tree-admin-title">Add a detailed event</h2>
        <form onSubmit={handleDetailedAdd}>
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            placeholder="Event title"
            value={detailedTitle}
            onChange={(e) => setDetailedTitle(e.target.value)}
          />
          <input
            className="chat-text-input"
            style={{ width: "100%", marginBottom: 10 }}
            placeholder="Description (optional)"
            value={detailedDescription}
            onChange={(e) => setDetailedDescription(e.target.value)}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <input type="checkbox" checked={allowRsvp} onChange={(e) => setAllowRsvp(e.target.checked)} />
            Allow people to RSVP (Yes / No / Maybe)
          </label>
          <div style={{ marginBottom: 10, display: "flex", gap: 16 }}>
            <label>
              <input type="radio" checked={visibility === "everyone"} onChange={() => setVisibility("everyone")} /> Everyone can see
            </label>
            <label>
              <input type="radio" checked={visibility === "selected"} onChange={() => setVisibility("selected")} /> Only selected people
            </label>
          </div>
          <div style={{ marginBottom: 10, display: "flex", gap: 16 }}>
            <label>
              <input type="radio" checked={dateMode === "oneTime"} onChange={() => setDateMode("oneTime")} /> One-time
            </label>
            <label>
              <input type="radio" checked={dateMode === "annual"} onChange={() => setDateMode("annual")} /> Every year (birthday, holiday)
            </label>
          </div>
          {dateMode === "oneTime" ? (
            <input
              type="date"
              className="chat-text-input"
              style={{ marginBottom: 10 }}
              value={oneTimeDate}
              onChange={(e) => setOneTimeDate(e.target.value)}
            />
          ) : (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <select value={annualMonth} onChange={(e) => setAnnualMonth(e.target.value)}>
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>{MONTH_THEME[i]} {m}</option>
                ))}
              </select>
              <select value={annualDay} onChange={(e) => setAnnualDay(e.target.value)}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
          {visibility === "selected" && (
            <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 10 }}>
              {users
                .filter((u) => !profile || u.id.toString() !== profile.id.toString())
                .map((u) => (
                  <label key={u.id.toString()} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(u.id.toString())}
                      onChange={() => toggleSelectedUser(u.id.toString())}
                    />
                    {u.username}
                  </label>
                ))}
            </div>
          )}
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#8a7860" }}>Cover photo (optional)</label>
            <input type="file" accept="image/png,image/jpeg" onChange={handleDetailedPhotoChange} />
            {detailedCoverPhoto && (
              <div className="tree-rel" style={{ marginTop: 6 }}>Photo: {detailedCoverPhoto.name}</div>
            )}
          </div>
          <button className="chat-send-button" type="submit">Add event</button>
        </form>
      </div>

      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
