'use client';

import '@/app/globals.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PasswordInput } from '@/components/ui/password-input';
import { createClient } from '@/lib/supabase/client';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      // Optional: Redirect after a few seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
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

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-zinc-900">
        <div className="w-full max-w-md space-y-8 bg-white dark:bg-zinc-800 p-10 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
            <svg
              className="h-10 w-10 text-green-600 dark:text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Password Updated!
          </h2>
          <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
            Your password has been changed successfully. You will be redirected
            to the login page shortly.
          </p>
          <div className="mt-8">
            <Link
              href="/login"
              className="text-sm font-semibold text-[#23255d] hover:text-[#23255d]/80 dark:text-yellow-500 dark:hover:text-yellow-500/80"
            >
              Go to Login &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-zinc-900">
      <div className="w-full max-w-md space-y-8 bg-white dark:bg-zinc-800 p-10 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Baci
          </h1>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Set new password
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Please enter a new password for your account.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleUpdate}>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-900/50">
              <div className="flex">
                <div className="text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="password" className="sr-only">
              New Password
            </label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="relative block w-full rounded-md border-0 py-3 text-gray-900 dark:text-white dark:bg-zinc-900 ring-1 ring-inset ring-gray-300 dark:ring-zinc-700 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-yellow-500 sm:text-sm sm:leading-6 px-4 shadow-sm"
              placeholder="New Password"
              minLength={6}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md bg-[#23255d] px-3 py-3 text-sm font-semibold text-white hover:bg-[#23255d]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23255d] disabled:opacity-70 transition-all shadow-md"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
