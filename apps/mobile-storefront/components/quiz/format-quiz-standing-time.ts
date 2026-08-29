export function formatQuizStandingTime(
  totalTimeSeconds: number | null
): string | null {
  if (totalTimeSeconds === null || !Number.isFinite(totalTimeSeconds)) {
    return null;
  }

  const safeSeconds = Math.max(0, totalTimeSeconds);
  if (safeSeconds < 60) return `${safeSeconds.toFixed(2)}s`;

  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
}
