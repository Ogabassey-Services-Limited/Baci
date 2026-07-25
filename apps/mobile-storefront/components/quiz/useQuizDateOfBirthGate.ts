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
 *
 * Two concurrency/correctness safeguards (each start burns a limited attempt):
 * - A monotonic `generation` guards late `setDateOfBirth` completions. The
 *   prompt's save resolves asynchronously; if the shopper submits, cancels, and
 *   then reopens the gate for another event before the first save resolves, the
 *   in-flight promise still holds the pre-cancel confirm closure. `confirmGate`
 *   only starts when the generation it captured at open time still matches, so
 *   a stale completion cannot start the newly-pending event.
 * - `reopenForCorrection` forces the gate open even when `date_of_birth` is
 *   already populated, so a stored DOB the server age gate rejected (an adult
 *   mistyped it) can still be corrected — a rejected start never creates an
 *   attempt, and the gate is the only DOB editor.
 */
export function useQuizDateOfBirthGate(onStart: (eventId: string) => void) {
  const customer = useAuthStore((state) => state.customer);
  const dateOfBirth = customer?.date_of_birth ?? null;
  const isCustomerLoaded = customer !== null;

  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  // Set when reopening a populated-but-rejected DOB for correction; also makes
  // the gate visible despite a stored date of birth.
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const pendingEventRef = useRef<string | null>(null);
  const generationRef = useRef(0);

  // Bump on every open/cancel so any save started under a prior generation is
  // rejected by confirmGate. The ref is the source of truth (read synchronously
  // in confirmGate); the state mirror lets the modal snapshot the generation at
  // render time and hand it back on success.
  const bumpGeneration = () => {
    generationRef.current += 1;
    setGeneration(generationRef.current);
  };

  const requestStart = (eventId: string) => {
    if (dateOfBirth) {
      onStart(eventId);
      return;
    }
    if (isCustomerLoaded) {
      // Loaded row with no date of birth: we know one is needed.
      bumpGeneration();
      pendingEventRef.current = eventId;
      setPendingEventId(eventId);
      setCorrectionError(null);
      return;
    }
    // Customer not resolved yet (hydrating or sync failure). Defer to the
    // server rather than swallowing the tap or flashing the prompt.
    onStart(eventId);
  };

  const reopenForCorrection = (eventId: string, message: string) => {
    bumpGeneration();
    pendingEventRef.current = eventId;
    setPendingEventId(eventId);
    setCorrectionError(message);
  };

  const cancelGate = () => {
    // Invalidate any in-flight save's confirm, then clear the pending event.
    bumpGeneration();
    pendingEventRef.current = null;
    setPendingEventId(null);
    setCorrectionError(null);
  };

  const confirmGate = (savedGeneration: number) => {
    // Ignore a save whose gate has since been cancelled or reopened for another
    // event (generation moved on) so it cannot start the wrong attempt.
    if (savedGeneration !== generationRef.current) {
      return;
    }
    const eventId = pendingEventRef.current;
    pendingEventRef.current = null;
    setPendingEventId(null);
    setCorrectionError(null);
    if (eventId) {
      onStart(eventId);
    }
  };

  return {
    cancelGate,
    confirmGate,
    correctionError,
    generation,
    isGateVisible:
      pendingEventId !== null &&
      isCustomerLoaded &&
      (!dateOfBirth || correctionError !== null),
    reopenForCorrection,
    requestStart,
  };
}
