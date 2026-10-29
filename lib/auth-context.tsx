'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import AccountNoticeModal from '@/components/AccountNoticeModal';
import { disablePush } from '@/lib/push-client';
import type { AccountNotice } from '@/lib/ban-duration';

export type AuthUser = {
  id: string;
  name: string;
  role: 'CUSTOMER' | 'SELLER' | 'RIDER' | 'ADMIN' | 'ASM';
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  isSignInOpen: boolean;
  openSignIn: () => void;
  closeSignIn: () => void;
};

type MeResponse = { user?: AuthUser | null; notice?: AccountNotice };

const AuthContext = createContext<AuthContextValue | null>(null);

// A logged-in person is asked now and then (and whenever they come back to the tab) whether they are still allowed
// in, so an admin's ban logs them out within about half a minute even if they just sit on a page.
const SESSION_CHECK_INTERVAL_MS = 30_000;

const isSameUser = (a: AuthUser | null, b: AuthUser | null) => a === b || (a !== null && b !== null && a.id === b.id && a.name === b.name && a.role === b.role);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  // Set when the server logged this person out because their account was banned or deleted.
  const [notice, setNotice] = useState<AccountNotice | null>(null);

  const applyResponse = useCallback((data: MeResponse) => {
    const next = data.user ?? null;

    // The same person keeps the same object, so the regular check doesn't re-run everything that watches `user`.
    setUser((current) => (isSameUser(current, next) ? current : next));

    if (data.notice) {
      setNotice(data.notice);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      applyResponse(await response.json());
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [applyResponse]);

  const logout = useCallback(async () => {
    // This device stops getting the account's notifications (the next person to log in here chooses for themselves).
    await disablePush();
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data: MeResponse = await response.json();
        if (isMounted) {
          applyResponse(data);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [applyResponse]);

  const isLoggedIn = user !== null;

  useEffect(() => {
    if (!isLoggedIn) return;

    const check = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const response = await fetch('/api/auth/me');

        if (response.ok) applyResponse(await response.json());
      } catch {
        // Offline or a hiccup: stay as we are. Only the server saying "nobody" (or a ban) logs the person out.
      }
    };

    const timer = window.setInterval(check, SESSION_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', check);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [isLoggedIn, applyResponse]);

  const value: AuthContextValue = {
    user,
    isLoading,
    refresh,
    logout,
    isSignInOpen,
    openSignIn: () => setIsSignInOpen(true),
    closeSignIn: () => setIsSignInOpen(false),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {notice ? <AccountNoticeModal notice={notice} onClose={() => setNotice(null)} /> : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
