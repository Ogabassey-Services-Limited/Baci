'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { apiPost } from '@/lib/api-client';
import {
  type MerchantQuizGenerationResponse,
  merchantQuizGenerationResponseSchema,
} from '@/schemas/quiz';

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

export function QuizAdminClient() {
  const [title, setTitle] = useState('Daily Phone Quiz');
  const [topics, setTopics] = useState(defaultTopics.join('\n'));
  const [prizeName, setPrizeName] = useState('Quiz prize');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(30);
  const [questionCountPerTopic, setQuestionCountPerTopic] = useState(1);
  const [difficulty, setDifficulty] = useState<'easy' | 'standard' | 'hard'>(
    'standard'
  );
  const [result, setResult] = useState<MerchantQuizGenerationResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      const parsed = merchantQuizGenerationResponseSchema.safeParse(
        await apiPost('/api/merchant/quiz/generate', {
          difficulty,
          prizeName,
          questionCountPerTopic,
          timeLimitSeconds,
          title,
          topics: topicsFromTextarea(topics),
        })
      );
      if (!parsed.success) {
        throw new Error('Invalid quiz generation response');
      }
      setResult(parsed.data);
    } catch (error) {
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
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Prize name
            <input
              className="h-11 rounded-md border bg-background px-3 text-sm"
              value={prizeName}
              onChange={(event) => setPrizeName(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Difficulty
            <select
              className="h-11 rounded-md border bg-background px-3 text-sm"
              value={difficulty}
              onChange={(event) =>
                setDifficulty(
                  event.target.value as 'easy' | 'standard' | 'hard'
                )
              }
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
              type="number"
              value={timeLimitSeconds}
              onChange={(event) =>
                setTimeLimitSeconds(
                  clampNumber(Number(event.target.value), 5, 60)
                )
              }
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Questions per topic
            <input
              className="h-11 rounded-md border bg-background px-3 text-sm"
              min={1}
              max={5}
              type="number"
              value={questionCountPerTopic}
              onChange={(event) =>
                setQuestionCountPerTopic(
                  clampNumber(Number(event.target.value), 1, 5)
                )
              }
            />
          </label>
          <label className="grid gap-2 text-sm font-medium md:col-span-2">
            Topics
            <textarea
              className="min-h-28 rounded-md border bg-background px-3 py-2 text-sm"
              value={topics}
              onChange={(event) => setTopics(event.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
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
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-primary">Draft saved</p>
            <h2 className="text-xl font-semibold">{result.event.title}</h2>
            <p className="text-sm text-muted-foreground">
              Status: {result.event.status}
            </p>
          </div>
          <div className="mt-5 grid gap-3">
            {result.questions.map((question, index) => (
              <article
                key={`${question.topic}-${question.prompt}`}
                className="rounded-lg border p-4"
              >
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {question.topic} · Question {index + 1}
                </p>
                <h3 className="mt-2 font-semibold">{question.prompt}</h3>
                <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
                  {question.options.map((option) => (
                    <li key={option.id}>
                      {option.id}. {option.label}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
