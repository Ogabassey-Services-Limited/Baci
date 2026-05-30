'use client';

import { AlertTriangle, RefreshCcw } from 'lucide-react';
import './globals.css';
import { Button } from '@/components/ui/button';

// Font removed to prevent build errors in global-error.tsx
const inter = { variable: 'font-sans' };

// Global Error must include its own html and body tags
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-sans antialiased min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4`}
      >
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-xl space-y-6 text-center">
          <div className="size-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
            <AlertTriangle className="size-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Critical Error
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              A critical system error occurred. Please try refreshing the page.
            </p>
          </div>

          <div className="pt-2">
            <Button
              onClick={() => window.location.reload()}
              className="w-full flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              size="lg"
            >
              <RefreshCcw className="size-4" />
              Refresh Application
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-left overflow-auto max-h-48 text-xs font-mono text-gray-800 dark:text-gray-200">
              <p className="font-bold text-red-500 mb-2">
                {error.name}: {error.message}
              </p>
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
