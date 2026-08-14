import { formatQuizDuration } from './quiz-duration';

export function QuizPlanSummary({
  closesAt,
  questionCount,
  timePerQuestionSeconds,
  totalQuizDurationSeconds,
}: {
  closesAt: string;
  questionCount: number;
  timePerQuestionSeconds: number;
  totalQuizDurationSeconds?: number;
}) {
  return (
    <aside
      aria-label="Quiz plan summary"
      className="rounded-lg border bg-muted/35 p-4 text-sm"
    >
      <p className="font-semibold">Quiz summary</p>
      <p className="mt-1 text-muted-foreground">
        {questionCount} questions, {timePerQuestionSeconds} seconds each.
        Expected play:{' '}
        {formatQuizDuration(questionCount * timePerQuestionSeconds)}.
      </p>
      {totalQuizDurationSeconds !== undefined ? (
        <p className="mt-1 text-muted-foreground">
          Total quiz duration: {formatQuizDuration(totalQuizDurationSeconds)}.
        </p>
      ) : null}
      <p className="mt-1 text-muted-foreground">
        Universal close: {closesAt || 'Set the launch window.'} Late players get
        only the time remaining.
      </p>
    </aside>
  );
}
