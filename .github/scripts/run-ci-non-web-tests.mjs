import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolveNonWebTestFilterArgs } from './resolve-ci-non-web-test-filters.mjs';

function parseArgs(argv) {
  const args = {
    baseRef: 'origin/main',
    eventName: process.env.GITHUB_EVENT_NAME ?? 'pull_request',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base') {
      args.baseRef = argv[index + 1] ?? args.baseRef;
      index += 1;
    } else if (arg === '--event') {
      args.eventName = argv[index + 1] ?? args.eventName;
      index += 1;
    }
  }

  return args;
}

function turboTestArgs({ baseRef, dryRun, eventName }) {
  return [
    'turbo',
    'run',
    'test',
    '--concurrency=3',
    '--log-order=stream',
    eventName === 'pull_request'
      ? '--cache=local:rw,remote:r'
      : '--cache=local:rw,remote:rw',
    ...resolveNonWebTestFilterArgs({ baseRef, eventName }),
    ...(dryRun ? ['--dry=json'] : []),
  ];
}

function parseTurboDryRun(output) {
  const parsed = JSON.parse(output);
  if (!Array.isArray(parsed.tasks)) {
    throw new Error('Turbo dry-run output did not contain a task list');
  }

  return parsed.tasks;
}

function assertWebTaskExcluded(tasks) {
  const webTask = tasks.find(
    (task) =>
      task?.package === '@baci/web' ||
      (typeof task?.taskId === 'string' && task.taskId.startsWith('@baci/web#'))
  );
  if (webTask) {
    throw new Error(
      `non-web Turbo test selection included ${webTask.taskId ?? '@baci/web'}`
    );
  }
}

/**
 * Uses Turbo's own dry-run task set as a preflight before executing the
 * non-web test job. This prevents an accidental web-suite duplicate.
 */
export function runCiNonWebTests({
  baseRef,
  eventName,
  execute = execFileSync,
  runTests = true,
}) {
  const dryRunOutput = execute(
    'pnpm',
    turboTestArgs({ baseRef, dryRun: true, eventName }),
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
  );
  const tasks = parseTurboDryRun(dryRunOutput);
  assertWebTaskExcluded(tasks);

  if (runTests) {
    execute('pnpm', turboTestArgs({ baseRef, dryRun: false, eventName }), {
      stdio: 'inherit',
    });
  }

  return tasks;
}

function main() {
  runCiNonWebTests(parseArgs(process.argv.slice(2)));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
