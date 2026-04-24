/**
 * React Query Provider with Deferred Persistence Hydration
 *
 * 2026 startup best practice for mobile reliability:
 * - Keep QueryClient available immediately
 * - Defer cache restore/subscription until after splash/first paint
 * - Avoid non-critical persistence work on the splash-critical path
 */

import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from '@tanstack/query-persist-client-core';
import {
  IsRestoringProvider,
  type Query,
  QueryClientProvider,
} from '@tanstack/react-query';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createLogger } from './logger';
import { queryClient, queryPersister } from './query-client';

const log = createLogger('QueryProvider');

interface QueryProviderProps {
  children: React.ReactNode;
  /**
   * Defer cache restore/subscription until after startup splash completes.
   * Prevents persistence hydration from competing with first render on Android.
   */
  persistenceEnabled?: boolean;
}

const PERSIST_MAX_AGE_MS = 1000 * 60 * 60 * 24;

export function QueryProvider({
  children,
  persistenceEnabled = true,
}: QueryProviderProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (!persistenceEnabled) {
      setIsRestoring(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const persistOptions = {
      queryClient,
      persister: queryPersister,
      maxAge: PERSIST_MAX_AGE_MS,
      dehydrateOptions: {
        shouldDehydrateQuery: (query: Query) => {
          // Don't persist failed or pending queries
          return query.state.status === 'success';
        },
      },
    };

    const startPersistence = async () => {
      if (!hasRestoredRef.current) {
        hasRestoredRef.current = true;
        setIsRestoring(true);
        try {
          await persistQueryClientRestore(persistOptions);
          log.debug('Cache hydrated from persisted storage');
        } catch (error) {
          log.warn('Cache hydration failed, continuing without restore', error);
        } finally {
          if (!cancelled) {
            setIsRestoring(false);
          }
        }
      }

      if (cancelled) return;
      unsubscribe = persistQueryClientSubscribe(persistOptions);
    };

    void startPersistence();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [persistenceEnabled]);

  return (
    <QueryClientProvider client={queryClient}>
      <IsRestoringProvider value={isRestoring}>{children}</IsRestoringProvider>
    </QueryClientProvider>
  );
}
