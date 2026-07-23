const HEARTBEAT_INTERVAL_MS = 30_000;

export function shouldRecordWorkerSuccess(
  lastRecordedAt: number | null,
  processedCount: number,
  now = Date.now()
): boolean {
  return (
    processedCount > 0 ||
    lastRecordedAt === null ||
    now - lastRecordedAt >= HEARTBEAT_INTERVAL_MS
  );
}
