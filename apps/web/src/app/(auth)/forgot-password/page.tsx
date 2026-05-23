'use client';

import '@/app/globals.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const _router = useRouter();
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        throw error;
      }

      setMessage('Check your email for the password reset link');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-zinc-900">
      <div className="w-full max-w-md space-y-8 bg-white dark:bg-zinc-800 p-10 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Baci
          </h1>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Reset your password
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Enter your email address and we'll send you a link to reset your
            password.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleReset}>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-900/50">
              <div className="flex">
                <div className="text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              </div>
            </div>
          )}

          {message && (
            <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-900/50">
              <div className="flex">
                <div className="text-sm text-green-700 dark:text-green-400">
                  {message}
                </div>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="email-address" className="sr-only">
              Email address
            </label>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="relative block w-full rounded-md border-0 py-3 text-gray-900 dark:text-white dark:bg-zinc-900 ring-1 ring-inset ring-gray-300 dark:ring-zinc-700 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-yellow-500 sm:text-sm sm:leading-6 px-4 shadow-sm"
              placeholder="Email address"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md bg-[#23255d] px-3 py-3 text-sm font-semibold text-white hover:bg-[#23255d]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23255d] disabled:opacity-70 transition-all shadow-md"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>

          <div className="text-sm text-center">
            <Link
              href="/login"
              className="font-medium text-[#23255d] dark:text-yellow-500 hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
