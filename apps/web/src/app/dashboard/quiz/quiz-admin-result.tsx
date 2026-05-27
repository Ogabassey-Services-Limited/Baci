import type { MerchantQuizGenerationResponse } from '@/schemas/quiz';

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
  result,
}: {
  result: MerchantQuizGenerationResponse;
}) {
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
      </div>
      <div className="mt-5 grid gap-3">
        {resultQuestions.map(({ key, position, question }) => (
          <article key={key} className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {question.topic} - Question {position}
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
  );
}
