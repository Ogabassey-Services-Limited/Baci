import type { ImeiServiceTierKey } from '@baci/shared/imei';
import { useEffect, useRef, useState } from 'react';
import {
  clearPendingImeiLookup,
  loadPendingImeiLookup,
  type PendingImeiLookup,
  pendingImeiStorageKey,
  savePendingImeiLookup,
} from '@/lib/imei-pending-storage';
import { pollImeiLookup } from '@/lib/imei-poll-client';
import type { ImeiResult } from '@/lib/validation';

const MAX_ACTIVE_POLL_MS = 5 * 60 * 1000;
const PAUSED_POLL_MS = 60 * 1000;

interface ActivePendingLookup extends PendingImeiLookup {
  pollAfterMs: number;
}

type PendingTerminal =
  | {
      kind: 'complete';
      lookupId: string;
      result: ImeiResult;
      tier: ImeiServiceTierKey;
    }
  | { error: string; kind: 'error'; tier: ImeiServiceTierKey };

export function useImeiPendingLookup({
  accessToken,
  apiBaseUrl,
  customerId,
  merchantId,
}: {
  accessToken?: string;
  apiBaseUrl: string;
  customerId?: string;
  merchantId?: string;
}) {
  const storageKey =
    merchantId && customerId
      ? pendingImeiStorageKey(merchantId, customerId)
      : null;
  const previousStorageKey = useRef<string | null>(null);
  const pendingMutation = useRef(0);
  const [pending, setPending] = useState<ActivePendingLookup | null>(null);
  const [paused, setPaused] = useState(false);
  const [terminal, setTerminal] = useState<PendingTerminal | null>(null);

  useEffect(() => {
    let cancelled = false;
    const restoreGeneration = pendingMutation.current;
    const restore = async () => {
      const previous = previousStorageKey.current;
      if (previous && previous !== storageKey) {
        await clearPendingImeiLookup(previous);
      }
      previousStorageKey.current = storageKey;

      if (!storageKey) {
        if (
          previous &&
          !cancelled &&
          pendingMutation.current === restoreGeneration
        ) {
          setPending(null);
        }
        return;
      }
      const saved = await loadPendingImeiLookup(storageKey);
      if (!cancelled && pendingMutation.current === restoreGeneration) {
        if (saved) {
          setPending({ ...saved, pollAfterMs: 0 });
        } else if (previous && previous !== storageKey) {
          setPending(null);
        }
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!pending) return;
    const isStale =
      Date.now() - Date.parse(pending.createdAt) >= MAX_ACTIVE_POLL_MS;
    if (isStale) {
      setPaused(true);
    }

    let cancelled = false;
    const timer = setTimeout(
      async () => {
        const outcome = await pollImeiLookup({
          accessToken,
          apiBaseUrl,
          lookupId: pending.lookupId,
        });
        if (cancelled) return;

        if (outcome.kind === 'pending' || outcome.kind === 'retry') {
          setPending((current) =>
            current ? { ...current, pollAfterMs: outcome.pollAfterMs } : current
          );
          return;
        }

        if (storageKey) await clearPendingImeiLookup(storageKey);
        setPending(null);
        setPaused(false);
        setTerminal(
          outcome.kind === 'complete'
            ? {
                kind: 'complete',
                lookupId: pending.lookupId,
                result: outcome.result,
                tier: pending.tier,
              }
            : { error: outcome.error, kind: 'error', tier: pending.tier }
        );
      },
      isStale ? PAUSED_POLL_MS : pending.pollAfterMs
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accessToken, apiBaseUrl, pending, storageKey]);

  return {
    async clear() {
      pendingMutation.current += 1;
      if (storageKey) await clearPendingImeiLookup(storageKey);
      setPending(null);
      setPaused(false);
    },
    clearTerminal() {
      setTerminal(null);
    },
    paused,
    pending,
    async start({
      lookupId,
      pollAfterMs,
      tier,
    }: {
      lookupId: string;
      pollAfterMs: number;
      tier: ImeiServiceTierKey;
    }) {
      pendingMutation.current += 1;
      const next = {
        createdAt: new Date().toISOString(),
        lookupId,
        pollAfterMs,
        tier,
      };
      if (storageKey) await savePendingImeiLookup(storageKey, next);
      setTerminal(null);
      setPaused(false);
      setPending(next);
    },
    terminal,
  };
}
