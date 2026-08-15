import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AuthClient } from "@icp-sdk/auth/client";
import { createAuthActor, IDENTITY_PROVIDER, THIRTY_DAYS_NS } from "../auth.js";

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
        const client = new AuthClient({ identityProvider: IDENTITY_PROVIDER });
        setAuthClient(client);
        if (client.isAuthenticated()) {
          const id = await client.getIdentity();
          await applyIdentity(id);
        }
      } catch (e) {
        setError(String(e));
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
      setError(String(e));
    }
  }, [authClient, applyIdentity]);

  const logout = useCallback(async () => {
    if (!authClient) return;
    await authClient.signOut();
    setIdentity(null);
    setPrincipal(null);
    setActor(null);
    setProfile(null);
  }, [authClient]);

  const register = useCallback(
    async (username, password) => {
      if (!actor || !authClient) return false;
      setError(null);
      try {
        const ok = await actor.register(username, password);
        if (ok) {
          const id = await authClient.getIdentity();
          await applyIdentity(id);
        } else {
          setError("Registration failed — wrong signup password, or that account may already exist.");
        }
        return ok;
      } catch (e) {
        setError(String(e));
        return false;
      }
    },
    [actor, authClient, applyIdentity]
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
    logout,
    register,
    reloadProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
