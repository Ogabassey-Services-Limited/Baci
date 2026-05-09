export function isStatusClean(status: string): boolean {
  const normalized = status.toLowerCase();
  return (
    normalized === 'clean' ||
    normalized === 'not found' ||
    normalized.includes('clean') ||
    normalized === 'off'
  );
}
