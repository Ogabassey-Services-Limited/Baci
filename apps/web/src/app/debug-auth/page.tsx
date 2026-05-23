'use client';

import '@/app/globals.css';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';

export default function DebugAuthPage() {
  const { user, loading } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [cookies, setCookies] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const supabase = createClient();

  const addLog = (msg: string) =>
    setLogs((prev) => [
      ...prev,
      `${new Date().toISOString().split('T')[1]} - ${msg}`,
    ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only run on mount
  useEffect(() => {
    // Get session on mount
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) addLog(`Session Error: ${error.message}`);
      else {
        setSession(data.session);
        addLog(`Session found: ${data.session ? 'YES' : 'NO'}`);
      }
    });
  }, []);

  useEffect(() => {
    // Set cookies separately to avoid synchronous state updates
    setCookies(document.cookie);
  }, []);

  const handleLogin = async () => {
    addLog('Attempting login...');
    const email = `test-${Math.floor(Math.random() * 10000)}@example.com`;
    const password = 'password123';

    // Sign up first
    addLog(`Signing up ${email}...`);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      addLog(`SignUp Error: ${signUpError.message}`);
      // Try login if user exists
      addLog('Trying login instead...');
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) addLog(`SignIn Error: ${signInError.message}`);
      else addLog('SignIn Success!');
    } else {
      addLog('SignUp Success!');
    }

    // Refresh session
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setCookies(document.cookie);
  };

  const handleClearCookies = () => {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      // biome-ignore lint/suspicious/noDocumentCookie: Debug tool
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
    setCookies(document.cookie);
    addLog('Cookies cleared');
  };

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Auth Debugger</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="border p-4 rounded">
          <h2 className="font-bold">Auth Context</h2>
          <pre>{JSON.stringify({ user: user?.email, loading }, null, 2)}</pre>
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-bold">Supabase Session</h2>
          <pre>
            {JSON.stringify(
              {
                hasSession: !!session,
                user: session?.user?.email,
                expires_at: session?.expires_at,
              },
              null,
              2
            )}
          </pre>
        </div>
      </div>

      <div className="border p-4 rounded">
        <h2 className="font-bold">Cookies</h2>
        <div className="break-all font-mono text-xs">{cookies}</div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleLogin}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Test Login Flow
        </button>
        <button
          type="button"
          onClick={handleClearCookies}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Clear Cookies
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-gray-500 text-white px-4 py-2 rounded"
        >
          Reload Page
        </button>
      </div>

      <div className="border p-4 rounded bg-black text-green-400 h-64 overflow-y-auto font-mono text-sm">
        {logs.map((log, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Logs are append-only
          <div key={i}>{log}</div>
        ))}
      </div>
    </div>
  );
}
