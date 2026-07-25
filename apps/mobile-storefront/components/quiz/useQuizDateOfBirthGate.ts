import { useEffect, useRef, useState } from 'react';
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
 * Three concurrency/correctness safeguards (each start burns a limited attempt):
 * - A monotonic `generation` guards late `setDateOfBirth` completions. The
 *   prompt's save resolves asynchronously; if the shopper submits, cancels, and
 *   then reopens the gate for another event before the first save resolves, the
 *   in-flight promise still holds the pre-cancel confirm closure. `confirmGate`
 *   only starts when the generation it captured at open time still matches, so
 *   a stale completion cannot start the newly-pending event.
 * - If that stale save nonetheless fills `date_of_birth` while another event is
 *   pending, an effect starts the pending event — its requirement is now met,
 *   so it must not strand behind a gate that has gone invisible.
 * - `reopenForCorrection` forces the gate open even when `date_of_birth` is
 *   already populated, so a stored DOB the server age gate rejected (an adult
 *   mistyped it) can still be corrected — a rejected start never creates an
 *   attempt, and the gate is the only DOB editor.
 */
export function useQuizDateOfBirthGate(onStart: (eventId: string) => void) {
  const customer = useAuthStore((state) => state.customer);
  const dateOfBirth = customer?.date_of_birth ?? null;
  const isCustomerLoaded = customer !== null;
  // Reactive identity of the signed-in shopper, bound to a pending gate so an
  // account switch mid-gate can't start the prior shopper's event under the new
  // session. This is the AUTH user id, not `customer.id`: the customer row
  // hydrates after the session is set, so `customer.id` is null during that
  // window — binding to it would mistake the null→id hydration of the SAME
  // shopper for an account switch and wrongly discard a pending correction. The
  // auth user id is stable across hydration and only changes on a real switch.
  const userId = useAuthStore((state) => state.user?.id ?? null);

  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  // Set when reopening a populated-but-rejected DOB for correction; also makes
  // the gate visible despite a stored date of birth.
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const pendingEventRef = useRef<string | null>(null);
  // The auth user who opened the currently-pending gate.
  const pendingUserRef = useRef<string | null>(null);
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
      pendingUserRef.current = userId;
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
    pendingUserRef.current = userId;
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

  // If a concurrent save fills date_of_birth while a request is still pending
  // (the shopper cancelled event A mid-save, opened event B, then A's stale save
  // resolved), B's DOB requirement is already met but its gate has gone
  // invisible — start B rather than stranding its Start tap. Correction mode is
  // excluded: there the stored DOB is the rejected value and must stay editable.
  useEffect(() => {
    if (pendingEventId === null) {
      return;
    }
    // Account switched (or signed out) while the gate was pending: the new
    // shopper never asked to start this event, so clear the pending request
    // instead of starting it under their session. Uses the auth user id, which
    // is stable across customer-row hydration (a null→id transition for the
    // same shopper is NOT a switch).
    if (userId !== pendingUserRef.current) {
      pendingEventRef.current = null;
      setPendingEventId(null);
      setCorrectionError(null);
      return;
    }
    if (dateOfBirth && correctionError === null) {
      const eventId = pendingEventRef.current;
      pendingEventRef.current = null;
      setPendingEventId(null);
      if (eventId) {
        onStart(eventId);
      }
    }
  }, [pendingEventId, dateOfBirth, correctionError, userId, onStart]);

  return {
    cancelGate,
    confirmGate,
    correctionError,
    // The stored (rejected) DOB, so a correction can pre-fill it for editing.
    dateOfBirth,
    generation,
    // A server-confirmed correction (correctionError) opens the gate even when
    // the customer row failed to hydrate — we have positive evidence a DOB is
    // required, so there is no risk of a modal flash. Otherwise fall back to the
    // "only when we can positively tell" rule: loaded row without a DOB.
    isGateVisible:
      pendingEventId !== null &&
      (correctionError !== null || (isCustomerLoaded && !dateOfBirth)),
    reopenForCorrection,
    requestStart,
  };
}
