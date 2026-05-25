#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_POLL_INTERVAL_MS = 3000;
const PROBE_TIMEOUT_MS = 1000;
const RELEASE_TIMEOUT_MS = 3000;
const FORWARDED_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];

export async function releaseResidentModels({
  baseUrl = DEFAULT_OLLAMA_BASE_URL,
  fetcher = globalThis.fetch,
  logger = console,
} = {}) {
  let models;

  try {
    const response = await fetcher(new URL('/api/ps', baseUrl), {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn(
        `[ollama-build-guard] Ollama probe returned HTTP ${response.status}; continuing build`
      );
      return [];
    }

    const body = await response.json();
    models = [
      ...new Set(
        (Array.isArray(body?.models) ? body.models : [])
          .map((model) => model?.name)
          .filter((name) => typeof name === 'string' && name.length > 0)
      ),
    ];
  } catch (error) {
    logger.warn(
      `[ollama-build-guard] Ollama probe unavailable; continuing build: ${formatError(error)}`
    );
    return [];
  }

  for (const model of models) {
    try {
      const response = await fetcher(new URL('/api/generate', baseUrl), {
        body: JSON.stringify({ keep_alive: 0, model }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        signal: AbortSignal.timeout(RELEASE_TIMEOUT_MS),
      });
      await response.text();

      if (!response.ok) {
        logger.warn(
          `[ollama-build-guard] Failed to release resident model ${model}: HTTP ${response.status}`
        );
        continue;
      }

      logger.log(`[ollama-build-guard] Released resident model ${model}`);
    } catch (error) {
      logger.warn(
        `[ollama-build-guard] Failed to release resident model ${model}; continuing build: ${formatError(error)}`
      );
    }
  }

  return models;
}

export async function runGuardedCommand(
  commandArguments,
  {
    logger = console,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    release = () => releaseResidentModels({ logger }),
    spawnChild = spawn,
  } = {}
) {
  if (!Array.isArray(commandArguments) || commandArguments.length === 0) {
    throw new Error('Usage: run-with-ollama-memory-guard.mjs -- <command> [arguments...]');
  }

  let releaseInProgress = false;
  const checkMemory = async () => {
    if (releaseInProgress) return;

    releaseInProgress = true;
    try {
      await release();
    } finally {
      releaseInProgress = false;
    }
  };

  await checkMemory();

  const [command, ...args] = commandArguments;
  const child = spawnChild(command, args, {
    env: process.env,
    stdio: 'inherit',
  });
  const signalHandlers = new Map(
    FORWARDED_SIGNALS.map((signal) => [
      signal,
      () => {
        child.kill(signal);
      },
    ])
  );

  for (const [signal, handler] of signalHandlers) {
    process.on(signal, handler);
  }

  const poller = setInterval(() => {
    void checkMemory().catch((error) => {
      logger.warn(
        `[ollama-build-guard] Guard iteration failed; continuing build: ${formatError(error)}`
      );
    });
  }, pollIntervalMs);

  try {
    return await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
  } finally {
    clearInterval(poller);
    for (const [signal, handler] of signalHandlers) {
      process.off(signal, handler);
    }
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  const separatorIndex = process.argv.indexOf('--');
  const commandArguments =
    separatorIndex === -1 ? process.argv.slice(2) : process.argv.slice(separatorIndex + 1);
  const { code, signal } = await runGuardedCommand(commandArguments);

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[ollama-build-guard] ${formatError(error)}`);
    process.exitCode = 1;
  });
}
