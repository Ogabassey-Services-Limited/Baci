import { useEffect, useRef, useState } from 'react';
import { QUIZ_AGE_RESTRICTED_MESSAGE } from '@/schemas/quiz-age-gate-message';
import type { QuizEventResponse } from '@/schemas/quiz';

type UpdateCustomer = (data: {
  date_of_birth: string;
}) => Promise<{ success: boolean; error?: string }>;

type UseQuizAgeGateArgs = {
  /** Starts the attempt; resolves to the error message on failure, else null. */
  runStart: (event: QuizEventResponse) => Promise<string | null>;
  updateCustomer: UpdateCustomer;
  /** Clears any page-level start error so the gate owns the single alert. */
  clearStartError: () => void;
  /**
   * The signed-in shopper's id (null while auth is resolving). A submit is bound
   * to this identity: if the account logs out or switches to another shopper
   * while the save or the start is in flight, the continuation is discarded so
   * it cannot start under the new session — each start burns one of that
   * shopper's limited attempts, and the DB write already carries their cookies.
   */
  currentCustomerId: string | null;
};

/**
 * Orchestrates the Super Quiz 18+ date-of-birth gate: it defers a start until a
 * DOB is captured, then saves it and starts the attempt.
 *
 * Concurrency safety (each successful start burns one of the player's limited
 * attempts, so this must never double-fire or start for the wrong shopper):
 * - `saveInFlightRef` is a synchronous guard: a double-tap on Continue cannot
 *   fire two saves before React disables the button, and — because it is NOT
 *   released on open/cancel, only when the PATCH itself settles — a cancel +
 *   reopen + resubmit cannot overlap two profile writes. That serialization is
 *   what stops a stale save from landing after (and overwriting) a corrected
 *   DOB; `tokenRef` alone cannot, since it only suppresses the quiz-start
 *   continuation, not the write.
 * - `tokenRef` is a monotonic cancellation token; cancelling (or re-opening for
 *   another event) invalidates any in-flight save so its continuation cannot
 *   start the quiz after the shopper dismissed the gate.
 * - `currentCustomerIdRef` snapshots the submitting shopper. Auth changes do not
 *   cancel this hook, so an account switch mid-save would otherwise let the
 *   continuation call `runStart` under the new session's cookies — the identity
 *   re-checks after each await discard the continuation instead.
 * - On a start failure it keeps the gate open with the error, so a mistyped or
 *   under-18 DOB can be corrected instead of stranding the shopper (there is no
 *   other DOB editor once `customer.date_of_birth` is set).
 */
export function useQuizAgeGate({
  runStart,
  updateCustomer,
  clearStartError,
  currentCustomerId,
}: UseQuizAgeGateArgs) {
  const [event, setEvent] = useState<QuizEventResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Reactive mirror of `saveInFlightRef`: stays true across a cancel + reopen
  // while the prior PATCH is still settling, so the reopened modal can keep
  // Continue disabled instead of silently dropping a tap that the write guard
  // would reject (see submit()).
  const [savePending, setSavePending] = useState(false);
  const saveInFlightRef = useRef(false);
  const tokenRef = useRef(0);
  // Latest committed shopper identity, mirrored into a ref so the async submit
  // can read it synchronously (a state closure would see the submit-time value).
  const currentCustomerIdRef = useRef(currentCustomerId);
  useEffect(() => {
    currentCustomerIdRef.current = currentCustomerId;
  }, [currentCustomerId]);

  // Opening or cancelling starts a new gate generation (bumps the token) and
  // clears the submitting spinner so a reopened modal is interactive. It does
  // NOT release `saveInFlightRef`: a prior PATCH still in flight must settle
  // first, so the next submit cannot overlap it (see submit()'s finally).
  // `initialError` seeds the alert when we reopen after the server rejected a
  // stored DOB (18+).
  const open = (next: QuizEventResponse, initialError: string | null = null) => {
    tokenRef.current += 1;
    setSubmitting(false);
    setError(initialError);
    setEvent(next);
  };

  const cancel = () => {
    tokenRef.current += 1;
    setSubmitting(false);
    setEvent(null);
  };

  const submit = async (dateOfBirth: string) => {
    // `saveInFlightRef` also serializes across a cancel + reopen: while a prior
    // PATCH is unresolved this returns, so the earlier write cannot overlap and
    // land after this one. `savePending` keeps the reopened modal's Continue
    // disabled during that window, so the shopper never taps into this no-op.
    if (!event || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSavePending(true);
    const token = tokenRef.current;
    // Bind this submit to the shopper who initiated it.
    const submitCustomerId = currentCustomerIdRef.current;
    setSubmitting(true);
    setError(null);
    try {
      const saved = await updateCustomer({ date_of_birth: dateOfBirth });
      if (token !== tokenRef.current) return;
      // Account switched or logged out during the save: discard rather than
      // start under the new session (which would spend the new shopper's
      // attempt on the event this shopper picked).
      if (currentCustomerIdRef.current !== submitCustomerId) return;
      if (!saved.success) {
        setError(saved.error ?? 'Could not save your date of birth.');
        return;
      }
      const startError = await runStart(event);
      if (token !== tokenRef.current) return;
      // Re-check: the switch may land in this second async window too.
      if (currentCustomerIdRef.current !== submitCustomerId) return;
      if (startError) {
        if (startError === QUIZ_AGE_RESTRICTED_MESSAGE) {
          // Age rejection: keep the gate open so the DOB can be corrected, and
          // take ownership of the single alert.
          clearStartError();
          setError(startError);
        } else {
          // Any other failure (attempt cap, closed event, transient API error)
          // is unrelated to the DOB, which now saved fine — close the gate and
          // let the page surface that error rather than re-prompting for
          // unchanged data.
          setEvent(null);
        }
        return;
      }
      setEvent(null);
    } finally {
      // Always release the write guard once THIS PATCH settles, so a later
      // submit is not blocked forever. Only the current generation may clear the
      // submitting state — a stale save resolving after a cancel/reopen must not
      // reset state a newer submission has already set.
      saveInFlightRef.current = false;
      setSavePending(false);
      if (token === tokenRef.current) {
        setSubmitting(false);
      }
    }
  };

  return { event, submitting, savePending, error, open, cancel, submit };
}
