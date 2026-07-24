import { useRef, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Gates quiz attempts on the customer having a date of birth on file. Super
 * Quiz is 18+, so a date of birth must exist before an attempt can start; the
 * server age gate (production) is the authoritative 18+ check and reads the
 * stored value at attempt time.
 *
 * Mirrors useQuizStartGate: the gate only opens when we can POSITIVELY tell the
 * shopper has no date of birth (their customer row is loaded and
 * `date_of_birth` is empty). While the row is still `null` — cold-start
 * hydration runs after the session is set, and a failed post-auth sync also
 * leaves it `null` — we do NOT guess: we fall back to the server start, which
 * is authoritative. That avoids both a modal flash for a returning shopper and
 * a dead Start button when hydration fails.
 */
export function useQuizDateOfBirthGate(onStart: (eventId: string) => void) {
  const customer = useAuthStore((state) => state.customer);
  const dateOfBirth = customer?.date_of_birth ?? null;
  const isCustomerLoaded = customer !== null;

  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  // Authoritative pending event, mirrored in a ref so a LATE success callback
  // reads the live value rather than the snapshot its closure captured. The
  // date-of-birth prompt's `setDateOfBirth` resolves asynchronously; if the
  // shopper taps Continue and then Cancel before the RPC returns, the in-flight
  // promise still holds the pre-cancel `confirmGate` closure. Reading
  // `pendingEventId` state from that stale closure would start the quiz (and
  // spend the exam pass) despite the cancellation. The ref is a stable object
  // across renders, so any closure sees `cancelGate` having cleared it.
  const pendingEventRef = useRef<string | null>(null);

  const requestStart = (eventId: string) => {
    if (dateOfBirth) {
      onStart(eventId);
      return;
    }
    if (isCustomerLoaded) {
      // Loaded row with no date of birth: we know one is needed.
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
    isGateVisible: pendingEventId !== null && isCustomerLoaded && !dateOfBirth,
    requestStart,
  };
}
