'use client';

import type { User } from '@supabase/supabase-js';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createClient } from '@/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start with loading as true
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // Use getUser() which makes an API call to verify the session with Supabase
    // This is more reliable than getSession() after server-side redirects where
    // cookies may take a moment to be available in document.cookie
    const initializeAuth = async () => {
      // First try: Use getUser() which verifies session with the server
      const {
        data: { user: verifiedUser },
        error,
      } = await supabase.auth.getUser();

      if (verifiedUser) {
        setUser(verifiedUser);
        setLoading(false);
        return;
      }

      // If no user found but no error (could be race condition after login),
      // wait briefly and try once more. This handles the case where
      // server-side cookies haven't fully propagated to the client yet.
      if (!error || error.message?.includes('session')) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const { data: retryData } = await supabase.auth.getUser();
        if (retryData.user) {
          setUser(retryData.user);
          setLoading(false);
          return;
        }
      }

      // No valid session found
      setUser(null);
      setLoading(false);
    };

    initializeAuth();

    // Listen for subsequent auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = { user, loading, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
