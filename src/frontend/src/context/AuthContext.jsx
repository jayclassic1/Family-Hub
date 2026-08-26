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
    async (username, password) => {
      if (!actor || !identity) return false;
      setError(null);
      try {
        const ok = await actor.register(username, password);
        if (ok) {
          await applyIdentity(identity);
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

  const reloadProfile = useCallback(async () => {
    if (!authClient) return;
    const id = await authClient.getIdentity();
    await applyIdentity(id);
  }, [authClient, applyIdentity]);

  const value = {
    identity,
    principal,
    profile,
    loading,
    error,
    isLoggedIn: !!principal,
    needsRegistration: !!principal && !profile,
    login,
    loginWithPassword,
    logout,
    register,
    reloadProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
