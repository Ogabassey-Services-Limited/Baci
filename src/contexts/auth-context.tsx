
'use client';

import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
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
    // This is the most reliable way to get the user's auth state.
    // The onAuthStateChange listener fires once on initial load with the session
    // from storage (or null), and then again whenever the auth state changes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // **Crucially**, we only set loading to false AFTER this first check has completed.
      // This ensures we don't have a "false negative" where the app thinks the user
      // is logged out before the session has been restored.
      setLoading(false);
    });

    // Cleanup the subscription when the component unmounts
    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = { user, loading, signOut };

  return (
    <AuthContext.Provider value={value}>
      {children}
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
