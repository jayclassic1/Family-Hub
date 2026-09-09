import { useState, useEffect, useCallback, useRef } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createEventsActor } from "../events.js";
import { createVotesActor } from "../votes.js";
import { createRecipesActor } from "../recipesApi.js";
import { createAlbumsActor } from "../albums.js";
import { createGroupsActor } from "../groups.js";

const links = [
  { to: "/", label: "Home Chat", end: true },
  { to: "/groups", label: "Group Chat" },
  { to: "/games", label: "Games & Tools" },
  { to: "/events", label: "Event Calendar" },
  { to: "/albums", label: "Photo Albums" },
  { to: "/recipes", label: "Family Recipes" },
  { to: "/votes", label: "Votings" },
  { to: "/shop", label: "Love Shop" },
  { to: "/tree", label: "Family Tree" },
  { to: "/wallet", label: "Wallet" }
];

const CREATED_GLOW_PAGES = [
  { to: "/votes", storageKey: "navSeen:votes" },
  { to: "/recipes", storageKey: "navSeen:recipes" },
  { to: "/albums", storageKey: "navSeen:albums" },
  { to: "/groups", storageKey: "navSeen:groups" },
];

const POLL_INTERVAL_MS = 45000;

function maxCreated(items) {
  let max = 0;
  for (const item of items) {
    const n = Number(item.created);
    if (n > max) max = n;
  }
  return max;
}

function getSeen(storageKey) {
  const raw = localStorage.getItem(storageKey);
  return raw ? Number(raw) : 0;
}

function eventIsGlowing(events) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return events.some((e) => {
    let eventDay = null;
    if ("oneTime" in e.kind) {
      const d = new Date(Number(e.kind.oneTime.dateMillis));
      eventDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    } else if ("annual" in e.kind) {
      const month = Number(e.kind.annual.month) - 1;
      const day = Number(e.kind.annual.day);
      let candidate = new Date(now.getFullYear(), month, day);
      if (candidate < today) candidate = new Date(now.getFullYear() + 1, month, day);
      eventDay = candidate;
    }
    if (!eventDay) return false;
    const glowStart = new Date(eventDay);
    glowStart.setDate(glowStart.getDate() - 3);
    return today >= glowStart && today <= eventDay;
  });
}

export default function Nav() {
  const { profile, identity, logout, websiteName } = useAuth();
  const [glowPages, setGlowPages] = useState({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const latestCreatedRef = useRef({});

  const poll = useCallback(async () => {
    if (!identity) return;
    try {
      const [votesActor, recipesActor, albumsActor, groupsActor, eventsActor] = await Promise.all([
        createVotesActor(identity),
        createRecipesActor(identity),
        createAlbumsActor(identity),
        createGroupsActor(identity),
        createEventsActor(identity),
      ]);

      const [polls, recipes, albums, groups, events] = await Promise.all([
        votesActor.listPollsWithResults().catch(() => []),
        recipesActor.listRecipes().catch(() => []),
        albumsActor.listAlbums().catch(() => []),
        groupsActor.listGroups().catch(() => []),
        eventsActor.getVisibleEvents().catch(() => []),
      ]);

      const sources = {
        "/votes": maxCreated(polls),
        "/recipes": maxCreated(recipes),
        "/albums": maxCreated(albums),
        "/groups": maxCreated(groups),
      };
      latestCreatedRef.current = sources;

      const next = {};
      for (const { to, storageKey } of CREATED_GLOW_PAGES) {
        next[to] = sources[to] > getSeen(storageKey);
      }
      next["/events"] = eventIsGlowing(events);

      setGlowPages(next);
    } catch (e) {}
  }, [identity]);

  useEffect(() => {
    if (!identity) return;
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [identity, poll]);

  const handleNavClick = (to) => {
    setMobileOpen(false);
    const entry = CREATED_GLOW_PAGES.find((p) => p.to === to);
    if (!entry) return;
    const latest = latestCreatedRef.current[to];
    if (latest) {
      localStorage.setItem(entry.storageKey, String(latest));
      setGlowPages((prev) => ({ ...prev, [to]: false }));
    }
  };

  return (
    <nav className="nav">
      <div className="nav-title">🐟 {websiteName}</div>
      <button
        className="nav-hamburger"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label="Toggle menu"
        type="button"
      >
        ☰
      </button>
      <div className={"nav-links" + (mobileOpen ? " nav-mobile-open" : "")}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={() => handleNavClick(link.to)}
            className={({ isActive }) =>
              "nav-link" + (isActive ? " active" : "") + (glowPages[link.to] ? " nav-link-glow" : "")
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
      <div className={"nav-footer" + (mobileOpen ? " nav-mobile-open" : "")}>
        {profile && <div className="nav-user">👤 {profile.username}</div>}
        <button className="nav-logout" onClick={logout}>Sign out</button>
      </div>
    </nav>
  );
}
