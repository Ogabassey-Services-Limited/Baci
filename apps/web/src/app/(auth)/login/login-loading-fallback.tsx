export default function LoginLoadingFallback() {
  return (
    <output
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-[50vh] items-center justify-center"
    >
      <span className="sr-only">Loading login…</span>
      <span
        aria-hidden="true"
        className="block size-8 animate-spin rounded-full border-2 border-muted border-t-primary"
      />
    </output>
  );
}
