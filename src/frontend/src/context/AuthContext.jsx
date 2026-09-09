import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AuthClient } from "@icp-sdk/auth/client";
import { createAuthActor, IDENTITY_PROVIDER, DERIVATION_ORIGIN, THIRTY_DAYS_NS } from "../auth.js";
import { deriveIdentityFromPassword, savePasswordSession, loadPasswordSession, clearPasswordSession } from "../passwordAuth.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authClient, setAuthClient] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [principal, setPrincipal] = useState(null);
  const [actor, setActor] = useState(null);
  const [profile, setProfile] = useState(null);
  const [websiteName, setWebsiteName] = useState("Family Hub");

  useEffect(() => {
    document.title = websiteName;
  }, [websiteName]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const applyIdentity = useCallback(async (id) => {
    const p = id.getPrincipal();
    const a = await createAuthActor(id);
    setIdentity(id);
    setActor(a);
    if (!p.isAnonymous()) {
      setPrincipal(p.toString());
      const result = await a.getUser(p);
      setProfile(result.length > 0 ? result[0] : null);
    } else {
      setPrincipal(null);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const anon = await createAuthActor();
        const name = await anon.getWebsiteName();
        if (name) setWebsiteName(name);
      } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const client = new AuthClient({
          identityProvider: IDENTITY_PROVIDER,
          derivationOrigin: DERIVATION_ORIGIN,
          idleOptions: { disableIdle: true },
        });
        setAuthClient(client);
        if (client.isAuthenticated()) {
          const id = await client.getIdentity();
          await applyIdentity(id);
        } else {
          const stored = loadPasswordSession();
          if (stored) {
            await applyIdentity(stored);
          }
        }
      } catch (e) {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [applyIdentity]);

  const login = useCallback(async () => {
    if (!authClient) return;
    setError(null);
    try {
      const id = await authClient.signIn({ maxTimeToLive: THIRTY_DAYS_NS });
      await applyIdentity(id);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  }, [authClient, applyIdentity]);

  const logout = useCallback(async () => {
    if (authClient) {
      await authClient.signOut();
    }
    clearPasswordSession();
    setIdentity(null);
    setPrincipal(null);
    setActor(null);
    setProfile(null);
  }, [authClient]);

  const loginWithPassword = useCallback(
    async (username, password) => {
      setError(null);
      try {
        const id = await deriveIdentityFromPassword(username, password);
        await applyIdentity(id);
        savePasswordSession(id);
        return true;
      } catch (e) {
        setError("Something went wrong. Please try again.");
        return false;
      }
    },
    [applyIdentity]
  );

  const register = useCallback(
    async (username, password, siteName) => {
      if (!actor || !identity) return false;
      setError(null);
      try {
        const ok = await actor.register(username, password, siteName || "");
        if (ok) {
          await applyIdentity(identity);
          try {
            const updatedName = await actor.getWebsiteName();
            if (updatedName) setWebsiteName(updatedName);
          } catch (e) {}
        } else {
          setError("Registration failed — wrong signup password, or that account may already exist.");
        }
        return ok;
      } catch (e) {
        setError("Something went wrong. Please try again.");
        return false;
      }
    },
    [actor, identity, applyIdentity]
  );

  const refreshWebsiteName = useCallback(async () => {
    try {
      const a = actor || (await createAuthActor());
      const name = await a.getWebsiteName();
      if (name) setWebsiteName(name);
    } catch (e) {}
  }, [actor]);

  const reloadProfile = useCallback(async () => {
    if (!authClient) return;
    const id = await authClient.getIdentity();
    await applyIdentity(id);
  }, [authClient, applyIdentity]);

  const value = {
    identity,
    principal,
    profile,
    websiteName,
    loading,
    error,
    isLoggedIn: !!principal,
    needsRegistration: !!principal && !profile,
    login,
    loginWithPassword,
    logout,
    register,
    reloadProfile,
    refreshWebsiteName,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
