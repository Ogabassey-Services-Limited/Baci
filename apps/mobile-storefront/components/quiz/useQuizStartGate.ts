import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Gates quiz attempts on the customer having a username set. Quiz results
 * are shown on a public leaderboard, so a display name must exist before an
 * attempt can start.
 */
export function useQuizStartGate(onStart: (eventId: string) => void) {
  // Read the whole customer row, not just `customer?.username`: on cold start
  // with an existing session the store sets `user`/`session` first and hydrates
  // `customer` asynchronously. During that window `customer` is `null`, which
  // must NOT be treated as "no username" — otherwise a returning shopper who
  // already has a username is shown the set-username modal and left stuck.
  const customer = useAuthStore((state) => state.customer);
  const username = customer?.username ?? null;
  const isCustomerLoaded = customer !== null;

  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  // Ensures a queued start fires at most once per request, so the hydration
  // auto-continue effect and confirmGate can never double-start the same event.
  const startedRef = useRef(false);

  const requestStart = (eventId: string) => {
    if (username) {
      onStart(eventId);
      return;
    }
    startedRef.current = false;
    setPendingEventId(eventId);
  };

  // Auto-continue a queued start once a username becomes available — whether it
  // arrived via late customer hydration (returning shopper) or the user just
  // set one in the modal. Without this, a start queued while `customer` was
  // still hydrating would stay pending even after the username appeared.
  useEffect(() => {
    if (pendingEventId !== null && username && !startedRef.current) {
      startedRef.current = true;
      const eventId = pendingEventId;
      setPendingEventId(null);
      onStart(eventId);
    }
  }, [pendingEventId, username, onStart]);

  const cancelGate = () => {
    setPendingEventId(null);
  };

  const confirmGate = () => {
    if (pendingEventId === null || startedRef.current) return;
    startedRef.current = true;
    const eventId = pendingEventId;
    setPendingEventId(null);
    onStart(eventId);
  };

  return {
    cancelGate,
    confirmGate,
    // Only surface the set-username prompt once the customer row is actually
    // loaded AND still has no username. While hydration is pending the modal
    // stays hidden and the queued start waits for the auto-continue effect.
    isGateVisible: pendingEventId !== null && isCustomerLoaded && !username,
    requestStart,
  };
}
