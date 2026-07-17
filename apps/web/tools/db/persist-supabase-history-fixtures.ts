import { access } from 'node:fs/promises';
import type { ReplayOutput } from './replay-repository-root';

export type SupabaseHistoryFixturePersistenceMode =
  | 'create'
  | 'refresh-effects'
  | 'refresh-post-deploy'
  | 'verify';

function outputExists(output: ReplayOutput): Promise<boolean> {
  return access(output.path).then(
    () => true,
    () => false
  );
}

async function assertOutput(
  output: ReplayOutput,
  expected: string
): Promise<void> {
  const actual = await output.read('utf8');
  if (typeof actual !== 'string' || actual !== expected) {
    throw new Error('Captured replay fixture drift');
  }
}

export async function persistSupabaseHistoryFixtures(options: {
  effectsBody: string;
  effectsOutput: ReplayOutput;
  linkedBody: string;
  linkedOutput: ReplayOutput;
  mode: SupabaseHistoryFixturePersistenceMode;
}): Promise<void> {
  if (options.mode === 'verify') {
    await assertOutput(options.linkedOutput, options.linkedBody);
    await assertOutput(options.effectsOutput, options.effectsBody);
    return;
  }
  if (options.mode === 'refresh-effects') {
    await assertOutput(options.linkedOutput, options.linkedBody);
    await options.effectsOutput.read();
    await options.effectsOutput.replace(options.effectsBody, { mode: 0o600 });
    return;
  }
  if (options.mode === 'refresh-post-deploy') {
    const [linkedBefore, effectsBefore] = await Promise.all([
      options.linkedOutput.read('utf8'),
      options.effectsOutput.read('utf8'),
    ]);
    if (typeof linkedBefore !== 'string' || typeof effectsBefore !== 'string') {
      throw new Error('Captured replay fixture read failed');
    }
    await options.linkedOutput.replace(options.linkedBody, { mode: 0o600 });
    try {
      await options.effectsOutput.replace(options.effectsBody, { mode: 0o600 });
    } catch (replaceFailure) {
      const rollbackFailures: unknown[] = [];
      try {
        await options.effectsOutput.replace(effectsBefore, { mode: 0o600 });
      } catch (rollbackFailure) {
        rollbackFailures.push(rollbackFailure);
      }
      try {
        await options.linkedOutput.replace(linkedBefore, { mode: 0o600 });
      } catch (rollbackFailure) {
        rollbackFailures.push(rollbackFailure);
      }
      if (rollbackFailures.length > 0) {
        throw new AggregateError(
          [replaceFailure, ...rollbackFailures],
          'Captured replay fixture rollback failed'
        );
      }
      throw replaceFailure;
    }
    return;
  }
  if (
    (await outputExists(options.linkedOutput)) ||
    (await outputExists(options.effectsOutput))
  ) {
    throw new Error('Captured replay fixture already exists');
  }
  await options.linkedOutput.create(options.linkedBody, { mode: 0o600 });
  try {
    await options.effectsOutput.create(options.effectsBody, { mode: 0o600 });
  } catch (createFailure) {
    try {
      await options.linkedOutput.remove();
    } catch (rollbackFailure) {
      throw new AggregateError(
        [createFailure, rollbackFailure],
        'Captured replay fixture rollback failed'
      );
    }
    throw createFailure;
  }
}
