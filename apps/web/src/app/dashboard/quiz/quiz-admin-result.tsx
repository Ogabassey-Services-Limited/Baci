'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { MerchantQuizGenerationResponse } from '@/schemas/quiz';

type ResultQuestion = MerchantQuizGenerationResponse['questions'][number];

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

function QuestionReview({
  position,
  question,
}: {
  position: number;
  question: ResultQuestion;
}) {
  return (
    <article className="rounded-lg border p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {question.topic} - Question {position}
      </p>
      <h3 className="mt-2 font-semibold">{question.prompt}</h3>
      <ul className="mt-3 grid gap-2 text-sm">
        {question.options.map((option) => {
          const isCorrect = option.id === question.correctOptionId;
          return (
            <li
              key={option.id}
              className={
                isCorrect
                  ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              }
            >
              {option.id}. {option.label}
              {isCorrect ? (
                <span className="ml-2 rounded bg-emerald-600/10 px-1.5 py-0.5 text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                  Correct
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Why: </span>
        {question.explanation}
      </p>
    </article>
  );
}

export function QuizAdminResult({
  activationError = null,
  isActivating = false,
  onActivate,
  result,
}: {
  activationError?: string | null;
  isActivating?: boolean;
  onActivate?: () => void;
  result: MerchantQuizGenerationResponse;
}) {
  const [hasReviewed, setHasReviewed] = useState(false);
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
            onClick={() => onActivate?.()}
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
