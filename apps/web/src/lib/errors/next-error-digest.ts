export function getNextErrorDigest(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('digest' in error)) {
    return undefined;
  }

  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== 'string') {
    return undefined;
  }

  const trimmedDigest = digest.trim();
  return trimmedDigest || undefined;
}
