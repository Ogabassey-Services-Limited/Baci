export default function LoginLoadingFallback() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
    >
      <span className="sr-only">Loading login…</span>
      <div
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary"
      />
    </div>
  );
}
