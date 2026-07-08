'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import type {
  MerchantQuizGenerationResponse,
  MerchantQuizPrizeProduct,
} from '@/schemas/quiz';
import {
  activateQuizEvent,
  clampNumber,
  clampNumberInput,
  generateQuizDraft,
  isQuizDifficulty,
  type QuizAnswerKeyReview,
  topicsFromTextarea,
} from './quiz-admin-actions';
import { QuizAdminResult } from './quiz-admin-result';

const defaultTopics = ['iPhone buying advice', 'Android buying advice'];

interface QuizAdminClientProps {
  initialPrizeProducts: MerchantQuizPrizeProduct[];
  initialPrizeProductsError?: string | null;
}

export function QuizAdminClient({
  initialPrizeProducts,
  initialPrizeProductsError = null,
}: QuizAdminClientProps) {
  const [title, setTitle] = useState('Daily Phone Quiz');
  const [topics, setTopics] = useState(defaultTopics.join('\n'));
  const [prizeProducts] =
    useState<MerchantQuizPrizeProduct[]>(initialPrizeProducts);
  const [selectedPrizeProductId, setSelectedPrizeProductId] = useState(
    initialPrizeProducts[0]?.id ?? ''
  );
  const [timeLimitSeconds, setTimeLimitSeconds] = useState('30');
  const [questionCountPerTopic, setQuestionCountPerTopic] = useState('1');
  const [difficulty, setDifficulty] = useState<'easy' | 'standard' | 'hard'>(
    'standard'
  );
  const [result, setResult] = useState<MerchantQuizGenerationResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(
    initialPrizeProductsError ??
      (initialPrizeProducts.length === 0
        ? 'Add an active product before creating a prize quiz.'
        : null)
  );
  const [activationError, setActivationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  const canGenerate =
    !isGenerating &&
    // Block a new draft while an "Open now" activation is in flight: otherwise a
    // newer generation can resolve first and then the older activation response
    // clobbers it, showing new questions under an old active event.
    !isActivating &&
    topicsFromTextarea(topics).length > 0 &&
    title.trim().length > 0 &&
    selectedPrizeProductId.length > 0;

  const handleGenerate = () => {
    setError(null);
    setActivationError(null);
    setResult(null);
    setIsGenerating(true);

    const normalizedTimeLimitSeconds = clampNumber(
      Number(timeLimitSeconds),
      5,
      60
    );
    const normalizedQuestionCountPerTopic = clampNumber(
      Number(questionCountPerTopic),
      1,
      5
    );
    setTimeLimitSeconds(String(normalizedTimeLimitSeconds));
    setQuestionCountPerTopic(String(normalizedQuestionCountPerTopic));

    generateQuizDraft({
      difficulty,
      prizeProductId: selectedPrizeProductId,
      questionCountPerTopic: normalizedQuestionCountPerTopic,
      timeLimitSeconds: normalizedTimeLimitSeconds,
      title,
      topics,
    })
      .then((data) => {
        setResult(data);
      })
      .catch((generationError: unknown) => {
        setResult(null);
        setError(
          generationError instanceof Error
            ? generationError.message
            : 'Failed to generate quiz draft'
        );
      })
      .finally(() => {
        setIsGenerating(false);
      });
  };

  const handleActivate = (answerKeyReview: QuizAnswerKeyReview) => {
    if (!result) return;
    // Pin the event being activated so a late response only updates the draft it
    // actually opened — never a newer draft the admin generated in the meantime.
    const activatingEventId = result.event.id;
    setActivationError(null);
    setIsActivating(true);

    activateQuizEvent(activatingEventId, answerKeyReview)
      .then((data) => {
        setResult((current) =>
          current && current.event.id === activatingEventId
            ? { ...current, event: data.event }
            : current
        );
      })
      .catch((activateError: unknown) => {
        setActivationError(
          activateError instanceof Error
            ? activateError.message
            : 'Failed to open quiz event'
        );
      })
      .finally(() => {
        setIsActivating(false);
      });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleGenerate();
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">
          Gemma quiz generation
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Quiz</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Generate a draft, review the AI-marked answers, then open the quiz.
        </p>
      </header>

      <form
        className="rounded-lg border bg-card p-5 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Quiz title
            <input
              className="h-11 rounded-md border bg-background px-3 text-sm"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Prize product
            <select
              className="h-11 rounded-md border bg-background px-3 text-sm"
              disabled={prizeProducts.length === 0}
              required
              value={selectedPrizeProductId}
              onChange={(event) =>
                setSelectedPrizeProductId(event.target.value)
              }
            >
              {prizeProducts.length === 0 ? (
                <option value="">No active products</option>
              ) : null}
              {prizeProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Difficulty
            <select
              className="h-11 rounded-md border bg-background px-3 text-sm"
              required
              value={difficulty}
              onChange={(event) => {
                const nextDifficulty = event.target.value;
                if (isQuizDifficulty(nextDifficulty)) {
                  setDifficulty(nextDifficulty);
                }
              }}
            >
              <option value="easy">Easy</option>
              <option value="standard">Standard</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Time limit
            <input
              className="h-11 rounded-md border bg-background px-3 text-sm"
              min={5}
              max={60}
              required
              step="1"
              type="number"
              value={timeLimitSeconds}
              onChange={(event) => setTimeLimitSeconds(event.target.value)}
              onBlur={() =>
                setTimeLimitSeconds(clampNumberInput(timeLimitSeconds, 5, 60))
              }
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Questions per topic
            <input
              className="h-11 rounded-md border bg-background px-3 text-sm"
              min={1}
              max={5}
              required
              step="1"
              type="number"
              value={questionCountPerTopic}
              onChange={(event) => setQuestionCountPerTopic(event.target.value)}
              onBlur={() =>
                setQuestionCountPerTopic(
                  clampNumberInput(questionCountPerTopic, 1, 5)
                )
              }
            />
          </label>
          <label className="grid gap-2 text-sm font-medium md:col-span-2">
            Topics
            <textarea
              className="min-h-28 rounded-md border bg-background px-3 py-2 text-sm"
              required
              value={topics}
              onChange={(event) => setTopics(event.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          disabled={!canGenerate}
        >
          {isGenerating ? (
            <Loader2 className="size-4 motion-safe:animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Generate draft
        </button>
      </form>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {result ? (
        <QuizAdminResult
          activationError={activationError}
          isActivating={isActivating}
          onActivate={handleActivate}
          result={result}
        />
      ) : null}
    </div>
  );
}
