import { useRef, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Gates quiz attempts on the customer having a username set. Quiz results
 * are shown on a public leaderboard, so a display name must exist before an
 * attempt can start.
 *
 * The gate only opens when we can POSITIVELY tell the shopper has no username
 * (their customer row is loaded and `username` is empty). While the customer
 * row is still `null` — cold-start hydration runs after the session is set, and
 * a failed post-auth sync also leaves it `null` — we do NOT guess: we fall back
 * to the server start, which is authoritative. It starts the attempt when the
 * row already has a username (returning shopper) or returns a
 * username-required / auth error the caller surfaces. That avoids both a modal
 * flash for a returning shopper and a dead Start button when hydration fails.
 */
export function useQuizStartGate(onStart: (eventId: string) => void) {
  const customer = useAuthStore((state) => state.customer);
  const username = customer?.username ?? null;
  const isCustomerLoaded = customer !== null;

  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  // Authoritative pending event, mirrored in a ref so a LATE success callback
  // reads the live value rather than the snapshot its closure captured. The
  // username prompt's `setUsername` resolves asynchronously; if the shopper
  // taps Continue and then Cancel before the RPC returns, the in-flight promise
  // still holds the pre-cancel `confirmGate` closure. Reading `pendingEventId`
  // state from that stale closure would start the quiz (and spend the exam
  // pass) despite the cancellation. The ref is a stable object across renders,
  // so any closure sees `cancelGate` having cleared it.
  const pendingEventRef = useRef<string | null>(null);

  const requestStart = (eventId: string) => {
    if (username) {
      onStart(eventId);
      return;
    }
    if (isCustomerLoaded) {
      // Loaded row with no username: we know a display name is needed.
      pendingEventRef.current = eventId;
      setPendingEventId(eventId);
      return;
    }
    // Customer not resolved yet (hydrating or sync failure). Defer to the
    // server rather than swallowing the tap or flashing the prompt.
    onStart(eventId);
  };

  const cancelGate = () => {
    // Clear the token first: a success callback that resolves after this must
    // be a no-op, even if it was created (and captured its event id) before the
    // cancel.
    pendingEventRef.current = null;
    setPendingEventId(null);
  };

  const confirmGate = () => {
    const eventId = pendingEventRef.current;
    pendingEventRef.current = null;
    setPendingEventId(null);
    if (eventId) onStart(eventId);
  };

  return {
    cancelGate,
    confirmGate,
    isGateVisible: pendingEventId !== null && isCustomerLoaded && !username,
    requestStart,
  };
}
