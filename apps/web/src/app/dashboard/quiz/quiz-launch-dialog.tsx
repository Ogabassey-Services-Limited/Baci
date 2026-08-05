'use client';

import { Loader2 } from 'lucide-react';
import type { QuizAnswerKeyReview } from './quiz-admin-actions';
import type { QuizDraftConfiguration } from './quiz-authoring-form';

function timingSummary(configuration: QuizDraftConfiguration): string {
  if (configuration.timingKind === 'scheduled') {
    return `${new Date(configuration.scheduledStart).toLocaleString()} to ${new Date(configuration.scheduledEnd).toLocaleString()}`;
  }
  return `Immediately, closing ${configuration.liveWindowMinutes} minutes later`;
}

export function QuizLaunchDialog({
  activationError,
  answerKeyReview,
  configuration,
  isLaunching,
  onCancel,
  onConfirm,
}: {
  activationError?: string | null;
  answerKeyReview: QuizAnswerKeyReview;
  configuration: QuizDraftConfiguration;
  isLaunching: boolean;
  onCancel: () => void;
  onConfirm: (review: QuizAnswerKeyReview) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      role="presentation"
    >
      <section
        aria-labelledby="launch-dialog-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-2xl"
        role="dialog"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Confirm {configuration.mode} launch
        </p>
        <h3 className="mt-2 text-xl font-semibold" id="launch-dialog-title">
          Launch quiz?
        </h3>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Prize</dt>
          <dd>
            {configuration.prizeProduct.name}
            {configuration.prizeProduct.variantLabel
              ? ` — ${configuration.prizeProduct.variantLabel}`
              : ''}
          </dd>
          <dt className="text-muted-foreground">Questions</dt>
          <dd>{answerKeyReview.questions.length}</dd>
          <dt className="text-muted-foreground">Timer</dt>
          <dd>{configuration.timePerQuestionSeconds} seconds per question</dd>
          <dt className="text-muted-foreground">Window</dt>
          <dd>{timingSummary(configuration)}</dd>
          <dt className="text-muted-foreground">Mode</dt>
          <dd className="capitalize">{configuration.mode}</dd>
        </dl>
        {configuration.mode === 'live' ? (
          <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Live prizes require production approval, verified compliance
            evidence, and an atomic inventory reservation. The server will fail
            closed if any gate is missing.
          </p>
        ) : (
          <p className="mt-4 rounded-md border border-sky-500/30 bg-sky-500/10 p-3 text-sm">
            Test mode is a private rehearsal. No prize inventory is reserved or
            awarded.
          </p>
        )}
        {activationError ? (
          <p
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {activationError}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="h-10 rounded-md border px-4 text-sm font-medium"
            disabled={isLaunching}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            disabled={isLaunching}
            onClick={() => onConfirm(answerKeyReview)}
            type="button"
          >
            {isLaunching ? <Loader2 className="size-4 animate-spin" /> : null}
            Launch quiz
          </button>
        </div>
      </section>
    </div>
  );
}
