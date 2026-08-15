import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { createDmsActor } from "../dms.js";
import { createWalletActor } from "../walletApi.js";
import { useTopBarActions } from "../context/TopBarActionsContext.jsx";

export default function TopBar() {
  const { profile, identity } = useAuth();
  const { action } = useTopBarActions() || {};
  const [hasUnread, setHasUnread] = useState(false);
  const [loveBalance, setLoveBalance] = useState(null);

  useEffect(() => {
    if (!identity) return;
    let cancelled = false;
    let dmsActor = null;

    const poll = async () => {
      try {
        if (!dmsActor) dmsActor = await createDmsActor(identity);
        const result = await dmsActor.hasUnread();
        if (!cancelled) setHasUnread(result);
      } catch (e) {}
    };

    poll();
    const interval = setInterval(poll, 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [identity]);

  useEffect(() => {
    if (!identity) return;
    let cancelled = false;
    let walletActor = null;

    const poll = async () => {
      try {
        if (!walletActor) walletActor = await createWalletActor(identity);
        const result = await walletActor.getMyLove();
        if (!cancelled) setLoveBalance(result);
      } catch (e) {}
    };

    poll();
    const interval = setInterval(poll, 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [identity]);

  return (
    <div className="topbar">
      <div className="topbar-left">{action}</div>
      <div className="topbar-right">
        {loveBalance !== null && (
          <div className="topbar-love-balance">💗 {loveBalance.toString()}</div>
        )}
        <NavLink
          to="/people"
          className={({ isActive }) => "topbar-button" + (isActive ? " active" : "") + (hasUnread ? " topbar-button-glow" : "")}
        >
          DMs
        </NavLink>
        {profile && (
          <NavLink
            to={"/profile/" + profile.id.toString()}
            className={({ isActive }) => "topbar-button" + (isActive ? " active" : "")}
          >
            Profile
          </NavLink>
        )}
        {profile && "admin" in profile.role && (
          <NavLink
            to="/admin"
            className={({ isActive }) => "topbar-button" + (isActive ? " active" : "")}
          >
            Admin
          </NavLink>
        )}
      </div>
    </div>
  );
}
