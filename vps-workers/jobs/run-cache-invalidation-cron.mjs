import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  CACHE_INVALIDATION_DEAD_LETTER_CODE,
  runWebCron,
} from './run-web-cron.mjs';

const PATH = '/api/cron/drain-cache-invalidations';
const MIN_INTERVAL_MS = 2 * 60_000;
const MAX_INTERVAL_MS = 30 * 60_000;

function parseState(raw) {
  try {
    const value = JSON.parse(raw);
    if (
      Number.isFinite(value.nextAllowedAt) &&
      Number.isFinite(value.intervalMs)
    ) {
      return value;
    }
  } catch {
    // Corrupt local state is equivalent to a cold start.
  }
  return { nextAllowedAt: 0, intervalMs: MIN_INTERVAL_MS };
}

async function persistState({ makeDirectory, move, state, stateFile, write }) {
  await makeDirectory(dirname(stateFile), { recursive: true });
  const temporaryFile = `${stateFile}.${process.pid}.tmp`;
  await write(temporaryFile, JSON.stringify(state), { mode: 0o600 });
  await move(temporaryFile, stateFile);
}

export async function runCacheInvalidationCron({
  env = process.env,
  now = Date.now(),
  run = runWebCron,
  read = readFile,
  write = writeFile,
  move = rename,
  makeDirectory = mkdir,
  logger = console,
} = {}) {
  const stateFile =
    env.CACHE_INVALIDATION_STATE_FILE ||
    '/tmp/baci-cache-invalidations-state.json';
  const state = parseState(await read(stateFile, 'utf8').catch(() => ''));
  if (now < state.nextAllowedAt) {
    return { skipped: true, nextAllowedAt: state.nextAllowedAt };
  }

  let result;
  try {
    result = await run({ path: PATH, env, logger });
  } catch (error) {
    // Preserve a short retry cadence for alerts/transient failures.
    const terminalAlert = error?.cacheDeadLetter === true;
    const retryMs = terminalAlert ? MAX_INTERVAL_MS : MIN_INTERVAL_MS;
    const nextState = { nextAllowedAt: now + retryMs, intervalMs: retryMs };
    await persistState({
      makeDirectory,
      move,
      state: nextState,
      stateFile,
      write,
    });
    throw error;
  }

  let payload = {};
  try {
    payload = JSON.parse(result.body);
  } catch {
    /* treat unknown 2xx body as work */
  }
  const deadLettersPresent = payload.deadLettersPresent === true;
  const newlyObservedDeadLetters =
    deadLettersPresent && state.deadLettersPresent !== true;
  if (newlyObservedDeadLetters) {
    logger.warn(
      JSON.stringify({
        event: CACHE_INVALIDATION_DEAD_LETTER_CODE,
        intervalMs: MAX_INTERVAL_MS,
        nextAllowedAt: now + MAX_INTERVAL_MS,
      })
    );
    const nextState = {
      nextAllowedAt: now + MAX_INTERVAL_MS,
      intervalMs: MAX_INTERVAL_MS,
      deadLettersPresent: true,
    };
    await persistState({
      makeDirectory,
      move,
      state: nextState,
      stateFile,
      write,
    });
    return {
      skipped: false,
      claimed: 0,
      deadLetter: true,
      intervalMs: MAX_INTERVAL_MS,
      nextAllowedAt: nextState.nextAllowedAt,
    };
  }
  const claimed = Number(payload.claimed) || 0;
  const intervalMs =
    claimed > 0
      ? MIN_INTERVAL_MS
      : Math.min(
          MAX_INTERVAL_MS,
          Math.max(MIN_INTERVAL_MS, state.intervalMs * 2)
        );
  const nextState = { nextAllowedAt: now + intervalMs, intervalMs };
  nextState.deadLettersPresent = deadLettersPresent;
  await persistState({
    makeDirectory,
    move,
    state: nextState,
    stateFile,
    write,
  });
  return {
    skipped: false,
    claimed,
    intervalMs,
    nextAllowedAt: nextState.nextAllowedAt,
  };
}

if (process.argv[1]?.endsWith('run-cache-invalidation-cron.mjs')) {
  await runCacheInvalidationCron();
}
