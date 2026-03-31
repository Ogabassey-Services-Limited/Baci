import type { PreviewBuildChunk } from '@/lib/import-jobs/import-job-service';

export function createFailingChunkGenerator(
  message: string
): AsyncGenerator<PreviewBuildChunk> {
  return (async function* () {
    // Keep the rejected first next() behavior while satisfying Biome's
    // useYield/useAwait rules for async generators in tests.
    yield* [];
    await Promise.resolve();
    throw new Error(message);
  })();
}
