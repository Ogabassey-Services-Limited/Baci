export function formatQuizDuration(seconds: number): string {
  const normalizedSeconds = Math.max(0, Math.trunc(seconds));
  const minutes = Math.floor(normalizedSeconds / 60);
  const remainder = normalizedSeconds % 60;
  if (!minutes) return `${remainder}s`;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}
