import type { MerchantQuizGenerationResponse } from '@/schemas/quiz';

type ResultQuestion = MerchantQuizGenerationResponse['questions'][number];

export function QuestionReview({
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
