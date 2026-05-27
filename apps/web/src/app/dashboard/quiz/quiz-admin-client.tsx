'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { apiPost } from '@/lib/api-client';
import {
  type MerchantQuizGenerationResponse,
  merchantQuizGenerationResponseSchema,
} from '@/schemas/quiz';
import { QuizAdminResult } from './quiz-admin-result';

const defaultTopics = ['iPhone buying advice', 'Android buying advice'];

function topicsFromTextarea(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((topic) => topic.trim())
    .filter(Boolean);
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function clampNumberInput(
  value: string,
  minimum: number,
  maximum: number
): string {
  return String(clampNumber(Number(value), minimum, maximum));
}

function isQuizDifficulty(
  value: string
): value is 'easy' | 'standard' | 'hard' {
  return value === 'easy' || value === 'standard' || value === 'hard';
}

function formatValidationSummary(
  issues: { message: string; path: PropertyKey[] }[]
): string {
  return issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'response'}: ${issue.message}`)
    .join('; ');
}

export function QuizAdminClient() {
  const [title, setTitle] = useState('Daily Phone Quiz');
  const [topics, setTopics] = useState(defaultTopics.join('\n'));
  const [prizeName, setPrizeName] = useState('Quiz prize');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState('30');
  const [questionCountPerTopic, setQuestionCountPerTopic] = useState('1');
  const [difficulty, setDifficulty] = useState<'easy' | 'standard' | 'hard'>(
    'standard'
  );
  const [publicationMode, setPublicationMode] = useState<'draft' | 'active'>(
    'draft'
  );
  const [result, setResult] = useState<MerchantQuizGenerationResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const canGenerate =
    !isGenerating &&
    topicsFromTextarea(topics).length > 0 &&
    title.trim().length > 0 &&
    prizeName.trim().length > 0;

  const handleGenerate = async () => {
    setError(null);
    setResult(null);
    setIsGenerating(true);
    try {
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

      const normalizedTopics = topicsFromTextarea(topics);
      if (normalizedTopics.length === 0) {
        throw new Error('Add at least one quiz topic before generating.');
      }

      const parsed = merchantQuizGenerationResponseSchema.safeParse(
        await apiPost('/api/merchant/quiz/generate', {
          difficulty,
          prizeName,
          publicationMode,
          questionCountPerTopic: normalizedQuestionCountPerTopic,
          timeLimitSeconds: normalizedTimeLimitSeconds,
          title,
          topics: normalizedTopics,
        })
      );
      if (!parsed.success) {
        const validationSummary = formatValidationSummary(parsed.error.issues);
        console.error('Invalid quiz generation response', parsed.error);
        throw new Error(
          `Invalid quiz generation response: ${validationSummary}`
        );
      }
      setResult(parsed.data);
    } catch (error) {
      setResult(null);
      setError(
        error instanceof Error ? error.message : 'Failed to generate quiz draft'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleGenerate();
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">
          Gemma quiz generation
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Quiz</h1>
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
            Prize name
            <input
              className="h-11 rounded-md border bg-background px-3 text-sm"
              required
              value={prizeName}
              onChange={(event) => setPrizeName(event.target.value)}
            />
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
            Publish
            <select
              className="h-11 rounded-md border bg-background px-3 text-sm"
              required
              value={publicationMode}
              onChange={(event) =>
                setPublicationMode(
                  event.target.value === 'active' ? 'active' : 'draft'
                )
              }
            >
              <option value="draft">Save draft</option>
              <option value="active">Open now</option>
            </select>
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
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {publicationMode === 'active'
            ? 'Generate and open'
            : 'Generate draft'}
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

      {result ? <QuizAdminResult result={result} /> : null}
    </div>
  );
}
