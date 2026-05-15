'use client';

import type { User } from '@supabase/supabase-js';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createClient } from '@/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: User | null;
}) {
  const initialUserRef = useRef(initialUser);
  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    // Get initial user - use getUser() instead of getSession() to ensure
    // we get fresh auth state after server-side login redirects.
    // getUser() validates the JWT with Supabase's server, preventing stale states.
    const initializeAuth = async () => {
      try {
        const {
          data: { user: refreshedUser },
        } = await supabase.auth.getUser();
        if (isMounted) {
          setUser(refreshedUser ?? null);
        }
      } catch (error) {
        console.error('[AuthProvider] Failed to initialize auth state', error);
        if (isMounted && !initialUserRef.current) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = createClient();
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

/**
 * Safe version that returns null instead of throwing when outside AuthProvider
 * Useful for components that may render in preview/demo mode without auth
 */
export function useAuthSafe(): AuthContextType | null {
  const context = useContext(AuthContext);
  return context ?? null;
}
