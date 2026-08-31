const activeDeadlines = new Map<symbol, number>();

function earliestActiveDeadline(): number | undefined {
  let earliest: number | undefined;
  for (const deadline of activeDeadlines.values()) {
    earliest = earliest === undefined ? deadline : Math.min(earliest, deadline);
  }
  return earliest;
}

export function remainingAuthStorageTimeout(defaultTimeoutMs: number): number {
  const operationDeadline = Date.now() + defaultTimeoutMs;
  const activeDeadline = earliestActiveDeadline();
  return Math.max(
    0,
    Math.min(operationDeadline, activeDeadline ?? operationDeadline) -
      Date.now()
  );
}

export async function runWithAuthStorageDeadline<T>(
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const token = Symbol('auth-storage-deadline');
  activeDeadlines.set(token, Date.now() + timeoutMs);
  try {
    return await operation();
  } finally {
    activeDeadlines.delete(token);
  }
}
