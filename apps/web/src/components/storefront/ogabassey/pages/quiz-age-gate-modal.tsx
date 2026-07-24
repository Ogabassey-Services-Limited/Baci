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
  serverError,
  onCancel,
  onSubmit,
}: QuizAgeGateModalProps) {
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset + focus each time the gate opens so a re-open starts clean.
  useEffect(() => {
    if (open) {
      setValue('');
      setValidationError(null);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  // The max attribute keeps the native picker from offering future dates.
  const today = new Date().toISOString().slice(0, 10);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        aria-labelledby={titleId}
        aria-modal="true"
        className={`w-full max-w-sm ${panel}`}
        onSubmit={handleSubmit}
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
          max={today}
          onChange={(event) => setValue(event.target.value)}
          ref={inputRef}
          type="date"
          value={value}
        />

        {message ? (
          <p
            className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
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
          <button className={primaryButton} disabled={submitting} type="submit">
            {submitting ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}
