import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { createAuthActor } from "../auth.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function AuthGate({ children }) {
  const { loading, isLoggedIn, needsRegistration, login, loginWithPassword, register, error, identity, logout, profile, reloadProfile, websiteName } = useAuth();
  const [isFirstEverUser, setIsFirstEverUser] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [username, setUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accessStatus, setAccessStatus] = useState(null);
  const [genderSubmitting, setGenderSubmitting] = useState(false);
  const [selectedGender, setSelectedGender] = useState(null);
  const [selectedInLaw, setSelectedInLaw] = useState(null);
  const [selectedBirthMonth, setSelectedBirthMonth] = useState("");
  const [selectedBirthDay, setSelectedBirthDay] = useState("");
  const [birthdaySubmitting, setBirthdaySubmitting] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordMode, setPasswordMode] = useState("login");
  const [pwUsername, setPwUsername] = useState("");
  const [pwPassword, setPwPassword] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);

  useEffect(() => {
    if (needsRegistration && pwUsername && !username) {
      setUsername(pwUsername);
    }
  }, [needsRegistration, pwUsername, username]);

  useEffect(() => {
    if (!identity || !needsRegistration) return;
    (async () => {
      try {
        const a = await createAuthActor(identity);
        const allUsers = await a.getAllUsers();
        setIsFirstEverUser(allUsers.length === 0);
      } catch (e) {
        setIsFirstEverUser(false);
      }
    })();
  }, [identity, needsRegistration]);

  useEffect(() => {
    if (!identity || needsRegistration) {
      setAccessStatus(null);
      return;
    }
    (async () => {
      try {
        const a = await createAuthActor(identity);
        const status = await a.getMyAccessStatus();
        setAccessStatus(status);
      } catch (e) {
        setAccessStatus(null);
      }
    })();
  }, [identity, needsRegistration]);

  if (loading) {
    return <div className="auth-screen"><p>Loading...</p></div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-emoji">🏡</div>
          <h1>{websiteName}</h1>
          {!showPasswordForm ? (
            <>
              <button className="auth-button" type="button" onClick={() => setShowPasswordForm(true)}>
                Login/Create
              </button>
              <p className="tree-rel" style={{ margin: "10px 0" }}>
                or
              </p>
              <button className="auth-button" onClick={login}>
                Login with Internet Identity
              </button>
              <p className="tree-rel" style={{ marginTop: 10 }}>
                (Not Recommended — More Complex)
              </p>
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 14 }}>
                <button
                  type="button"
                  className={"auth-button" + (passwordMode === "login" ? " active" : "")}
                  onClick={() => setPasswordMode("login")}
                >
                  Log In
                </button>
                <button
                  type="button"
                  className={"auth-button" + (passwordMode === "signup" ? " active" : "")}
                  onClick={() => setPasswordMode("signup")}
                >
                  New Here
                </button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!pwUsername.trim() || !pwPassword) return;
                  setPwSubmitting(true);
                  try {
                    await loginWithPassword(pwUsername.trim(), pwPassword);
                  } finally {
                    setPwSubmitting(false);
                  }
                }}
              >
                <input
                  className="auth-input"
                  value={pwUsername}
                  onChange={(e) => setPwUsername(e.target.value)}
                  placeholder="Your name"
                  disabled={pwSubmitting}
                />
                <input
                  className="auth-input"
                  type="password"
                  value={pwPassword}
                  onChange={(e) => setPwPassword(e.target.value)}
                  placeholder="Password"
                  disabled={pwSubmitting}
                />
                <button className="auth-button" type="submit" disabled={pwSubmitting}>
                  {pwSubmitting ? "..." : passwordMode === "login" ? "Log In" : "Continue"}
                </button>
              </form>
              {passwordMode === "login" && (
                <p className="tree-rel" style={{ marginTop: 8 }}>
                  Tip: your name and password must match exactly what you used before (capitalization counts).
                </p>
              )}
              {passwordMode === "signup" && (
                <p className="tree-rel" style={{ marginTop: 8 }}>
                  Pick any password — just remember it, since there's no way to reset it later.
                </p>
              )}
              <button
                type="button"
                className="tree-remove-btn"
                style={{ marginTop: 10 }}
                onClick={() => setShowPasswordForm(false)}
              >
                Back
              </button>
            </>
          )}
          {error && <p className="auth-error">{error}</p>}
        </div>
      </div>
    );
  }

  const needsGenderClassification = !needsRegistration && profile && profile.gender === "";

  if (needsGenderClassification) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-emoji">🙋</div>
          <h1>One more thing</h1>
          <p>To sort you into the right group chats, let us know your gender.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16 }}>
            <button
              className={"auth-button" + (selectedGender === "male" ? " active" : "")}
              type="button"
              onClick={() => setSelectedGender("male")}
            >
              Male
            </button>
            <button
              className={"auth-button" + (selectedGender === "female" ? " active" : "")}
              type="button"
              onClick={() => setSelectedGender("female")}
            >
              Female
            </button>
          </div>
          <p>Are you an in-law?</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16 }}>
            <button
              className={"auth-button" + (selectedInLaw === true ? " active" : "")}
              type="button"
              onClick={() => setSelectedInLaw(true)}
            >
              Yes
            </button>
            <button
              className={"auth-button" + (selectedInLaw === false ? " active" : "")}
              type="button"
              onClick={() => setSelectedInLaw(false)}
            >
              No
            </button>
          </div>
          <p>When’s your birthday?</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16 }}>
            <select
              className="auth-input"
              value={selectedBirthMonth}
              onChange={(e) => setSelectedBirthMonth(e.target.value)}
            >
              <option value="" disabled>Month</option>
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
            <select
              className="auth-input"
              value={selectedBirthDay}
              onChange={(e) => setSelectedBirthDay(e.target.value)}
            >
              <option value="" disabled>Day</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <button
            className="auth-button"
            disabled={genderSubmitting || !selectedGender || selectedInLaw === null || !selectedBirthMonth || !selectedBirthDay}
            onClick={async () => {
              setGenderSubmitting(true);
              try {
                const a = await createAuthActor(identity);
                await a.setGender(selectedGender);
                await a.setIsInLaw(selectedInLaw);
                await a.setBirthday(Number(selectedBirthMonth), Number(selectedBirthDay));
                await reloadProfile();
              } finally {
                setGenderSubmitting(false);
              }
            }}
          >
            {genderSubmitting ? "Saving..." : "Continue"}
          </button>
          {error && <p className="auth-error">{error}</p>}
        </div>
      </div>
    );
  }

  const needsBirthday =
    !needsRegistration && !needsGenderClassification && profile &&
    profile.birthdayMonth.length === 0;

  if (needsBirthday) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-emoji">🎂</div>
          <h1>One more thing</h1>
          <p>When’s your birthday? We’ll add it to the family calendar every year.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16 }}>
            <select
              className="auth-input"
              value={selectedBirthMonth}
              onChange={(e) => setSelectedBirthMonth(e.target.value)}
            >
              <option value="" disabled>Month</option>
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
            <select
              className="auth-input"
              value={selectedBirthDay}
              onChange={(e) => setSelectedBirthDay(e.target.value)}
            >
              <option value="" disabled>Day</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <button
            className="auth-button"
            disabled={birthdaySubmitting || !selectedBirthMonth || !selectedBirthDay}
            onClick={async () => {
              setBirthdaySubmitting(true);
              try {
                const a = await createAuthActor(identity);
                await a.setBirthday(Number(selectedBirthMonth), Number(selectedBirthDay));
                await reloadProfile();
              } finally {
                setBirthdaySubmitting(false);
              }
            }}
          >
            {birthdaySubmitting ? "Saving..." : "Continue"}
          </button>
          {error && <p className="auth-error">{error}</p>}
        </div>
      </div>
    );
  }

  if (needsRegistration) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-emoji">{isFirstEverUser ? "🎉" : "👋"}</div>
          <h1>{isFirstEverUser ? "Set up your family site!" : "Welcome!"}</h1>
          <p>
            {isFirstEverUser
              ? "You're the first one here — name your site, pick a family password for everyone else to sign up with, and choose your own name."
              : "Pick a name your family will see, and enter the family signup password."}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!username.trim() || !signupPassword) return;
              if (isFirstEverUser && !siteName.trim()) return;
              setSubmitting(true);
              try {
                await register(username.trim(), signupPassword, isFirstEverUser ? siteName.trim() : "");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {isFirstEverUser && (
              <input
                className="auth-input"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Name your site (e.g. The Smith Family Hub)"
                disabled={submitting}
              />
            )}
            <input
              className="auth-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your name"
              disabled={submitting}
            />
            <input
              className="auth-input"
              type="password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              placeholder="Family signup password"
              disabled={submitting}
            />
            <button className="auth-button" type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Continue"}
            </button>
          </form>
          {error && <p className="auth-error">{error}</p>}
        </div>
      </div>
    );
  }

  if (accessStatus && accessStatus.isBanned) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-emoji">🚫</div>
          <h1>Account restricted</h1>
          <p>Your access to Family Hub has been revoked by the admin.</p>
          <button className="auth-button" onClick={logout}>Sign out</button>
        </div>
      </div>
    );
  }

  if (accessStatus && accessStatus.blockedUntil.length > 0) {
    const untilMs = Number(accessStatus.blockedUntil[0]) / 1_000_000;
    const untilDate = new Date(untilMs);
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-emoji">⏸️</div>
          <h1>Temporarily blocked</h1>
          <p>Your access is paused until {untilDate.toLocaleString()}.</p>
          <button className="auth-button" onClick={logout}>Sign out</button>
        </div>
      </div>
    );
  }

  return children;
}
