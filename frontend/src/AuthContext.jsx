// AuthContext — remembers who is logged in so any page can use it:
//   const { user, login, logout } = useAuth();
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // true while we check a saved session on first load
  const [checking, setChecking] = useState(api.hasSession());
  // set when the server can't be reached on startup (so we don't wrongly send the user to /login)
  const [startupError, setStartupError] = useState(null);

  // When the backend says our session is dead, forget the user (ProtectedRoute then shows /login).
  useEffect(() => {
    api.setSessionExpiredHandler(() => setUser(null));
  }, []);

  // On page load: if we have saved tokens, ask the server who we are.
  useEffect(() => {
    if (!api.hasSession()) return;
    let cancelled = false;
    api
      .getMe()
      .then((me) => !cancelled && setUser(me))
      .catch((err) => {
        if (cancelled) return;
        setUser(null);
        if (err.code === 'NETWORK_ERROR') setStartupError(err.message);
      })
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const loggedIn = await api.login(email, password);
    setUser(loggedIn);
    return loggedIn;
  }, []);

  // Create the account, then log straight in (dev mode auto-verifies the email).
  const register = useCallback(
    async (form) => {
      await api.register(form);
      return login(form.universityEmail, form.password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, checking, startupError, login, register, logout }),
    [user, checking, startupError, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
