const questionAdFallback =
  'mx-auto my-5 flex min-h-[250px] w-full max-w-[300px] flex-col items-center justify-center rounded-lg border border-store-border bg-store-background/60 text-center';

export function QuizQuestionAdFallback() {
  return (
    <div
      aria-label="Reserved sponsored quiz placement"
      className={questionAdFallback}
      role="region"
    >
      <span className="text-[9px] font-semibold uppercase tracking-widest text-store-background-text/40">
        Sponsored
      </span>
    </div>
  );
}
