'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import type {
  MerchantQuizActivationInput,
  MerchantQuizGenerationResponse,
} from '@/schemas/quiz';
import { QuestionReview } from './quiz-question-review';

type AnswerKeyReview = MerchantQuizActivationInput['answerKeyReview'];

function createQuestionRenderItems(
  questions: MerchantQuizGenerationResponse['questions']
) {
  const occurrences = new Map<string, number>();
  let position = 0;

  return questions.map((question) => {
    position += 1;
    const baseKey = [
      question.topic,
      question.prompt,
      question.options
        .map((option) => `${option.id}:${option.label}`)
        .join('|'),
    ].join('::');
    const occurrence = occurrences.get(baseKey) ?? 0;
    occurrences.set(baseKey, occurrence + 1);

    return {
      key: `${baseKey}::${occurrence}`,
      position,
      question,
    };
  });
}

export function QuizAdminResult({
  activationError = null,
  isActivating = false,
  onActivate,
  result,
}: {
  activationError?: string | null;
  isActivating?: boolean;
  onActivate?: (answerKeyReview: AnswerKeyReview) => void;
  result: MerchantQuizGenerationResponse;
}) {
  const [hasReviewed, setHasReviewed] = useState(false);

  // The review confirmation is PER DRAFT: generating a new draft renders this
  // same component with a different event, and a checkbox left ticked for the
  // previous draft must not pre-authorize opening the new one. Render-time
  // prop-change reset (React Compiler-safe, no effect).
  const [trackedEventId, setTrackedEventId] = useState(result.event.id);
  if (result.event.id !== trackedEventId) {
    setTrackedEventId(result.event.id);
    setHasReviewed(false);
  }

  const resultQuestions = createQuestionRenderItems(result.questions);
  const isOpen = result.event.status === 'active';

  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-primary">
          {isOpen ? 'Quiz open' : 'Draft saved'}
        </p>
        <h2 className="text-xl font-semibold">{result.event.title}</h2>
        <p className="text-sm text-muted-foreground">
          Status: {result.event.status}
        </p>
        {isOpen ? null : (
          <p className="text-sm text-muted-foreground">
            Review the answer marked <strong>Correct</strong> for every question
            below, then open the quiz.
          </p>
        )}
      </div>
      <div className="mt-5 grid gap-3">
        {resultQuestions.map(({ key, position, question }) => (
          <QuestionReview key={key} position={position} question={question} />
        ))}
      </div>

      {isOpen ? (
        <p className="mt-5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          This quiz is live and accepting players.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-3 border-t pt-5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              checked={hasReviewed}
              className="size-4"
              onChange={(event) => setHasReviewed(event.target.checked)}
              type="checkbox"
            />
            I reviewed every correct answer and approve opening this quiz.
          </label>
          {activationError ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {activationError}
            </p>
          ) : null}
          <button
            className="inline-flex h-11 w-fit items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            disabled={!hasReviewed || isActivating || !onActivate}
            onClick={() =>
              onActivate?.({
                questions: resultQuestions.map(({ position, question }) => ({
                  correctOptionId: question.correctOptionId,
                  position,
                })),
              })
            }
            type="button"
          >
            {isActivating ? (
              <Loader2 className="size-4 motion-safe:animate-spin" />
            ) : null}
            Open now
          </button>
        </div>
      )}
    </section>
  );
}
