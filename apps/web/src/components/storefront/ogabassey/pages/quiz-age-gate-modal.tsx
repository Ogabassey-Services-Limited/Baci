'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { dateOfBirthSchema } from '@/schemas/customer-date-of-birth';
import {
  quizPanel as panel,
  quizPrimaryButton as primaryButton,
  quizSecondaryButton as secondaryButton,
} from './quiz-styles';

type QuizAgeGateModalProps = {
  open: boolean;
  submitting: boolean;
  /**
   * Disables Continue without showing the saving spinner: a prior submission's
   * write is still settling (after a cancel + reopen), so a new submit would be
   * a no-op until it releases. Cancel stays enabled.
   */
  disableSubmit?: boolean;
  /** Server-side error surfaced back to the modal (e.g. under-18 rejection). */
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (dateOfBirth: string) => void;
};

/**
 * Captures the customer's date of birth before a quiz attempt so the server
 * 18+ age gate (`enforceQuizAgeGate`) can run. Mirrors the mobile username gate:
 * a blocking prompt that resolves the missing profile field, then hands control
 * back to the caller to start the attempt. Eligibility (18+) is decided
 * server-side — this only collects a well-formed DOB.
 */
export function QuizAgeGateModal({
  open,
  submitting,
  disableSubmit = false,
  serverError,
  onCancel,
  onSubmit,
}: QuizAgeGateModalProps) {
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset + focus each time the gate opens so a re-open starts clean, and
  // restore focus to the element that opened it (the Start button) on close.
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    setValue('');
    setValidationError(null);
    inputRef.current?.focus();
    return () => triggerRef.current?.focus?.();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Ignore dismissal while a save is in flight: a late Escape must not
      // abandon a submission that has already started the quiz.
      if (event.key === 'Escape') {
        if (!submitting) onCancel();
        return;
      }
      // Trap Tab/Shift+Tab inside the dialog — `aria-modal` alone does not make
      // the background inert, so focus could otherwise escape to quiz controls.
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onCancel]);

  if (!open) return null;

  // The max attribute keeps the native picker from offering today or the
  // future — the latest acceptable DOB is yesterday (today is rejected by both
  // the shared schema and the server DOB RPC). `<input type="date">` reads this
  // in the viewer's LOCAL timezone, so derive local yesterday rather than a
  // UTC-minus-24h instant, which is off by a day for far-from-UTC viewers.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const maxDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = dateOfBirthSchema.safeParse(value);
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.message ?? 'Enter a valid date of birth'
      );
      return;
    }
    setValidationError(null);
    onSubmit(parsed.data);
  };

  const message = validationError ?? serverError;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--foreground))]/50 p-4"
      onMouseDown={(event) => {
        if (!submitting && event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        aria-labelledby={titleId}
        aria-modal="true"
        className={`w-full max-w-sm ${panel}`}
        onSubmit={handleSubmit}
        ref={dialogRef}
        role="dialog"
      >
        <h2 className="text-lg font-semibold" id={titleId}>
          Confirm your date of birth
        </h2>
        <p className="mt-2 text-sm leading-6 text-store-background-text/70">
          Super Quiz is for players aged 18 and over. Enter your date of birth
          to continue — we save it to your profile so you only do this once.
        </p>

        <label
          className="mt-4 block text-sm font-medium text-store-background-text"
          htmlFor={inputId}
        >
          Date of birth
        </label>
        <input
          className="mt-1 w-full rounded-lg border border-store-background-text/20 bg-transparent px-3 py-2 text-sm text-store-background-text"
          id={inputId}
          max={maxDate}
          onChange={(event) => setValue(event.target.value)}
          ref={inputRef}
          type="date"
          value={value}
        />

        {message ? (
          <p
            className="mt-3 rounded-lg border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-3 text-sm font-medium text-[hsl(var(--destructive))]"
            role="alert"
          >
            {message}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            className={secondaryButton}
            disabled={submitting}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className={primaryButton}
            disabled={submitting || disableSubmit}
            type="submit"
          >
            {submitting ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}
