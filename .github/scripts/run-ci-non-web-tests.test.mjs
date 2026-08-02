import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { runCiNonWebTests } from './run-ci-non-web-tests.mjs';

test('bugfix: can be imported when Node has no CLI filename', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `import ${JSON.stringify(pathToFileURL(new URL('./run-ci-non-web-tests.mjs', import.meta.url).pathname).href)};`,
    ],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
});

test('bugfix: rejects a Turbo dry run that selects the sharded web suite', () => {
  assert.throws(
    () =>
      runCiNonWebTests({
        baseRef: 'origin/main',
        eventName: 'pull_request',
        execute: () =>
          JSON.stringify({
            tasks: [{ package: '@baci/web', taskId: '@baci/web#test' }],
          }),
        runTests: false,
      }),
    /non-web Turbo test selection included @baci\/web#test/
  );
});

test('uses the Turbo range and exclusion in a successful dry-run command', () => {
  const calls = [];
  const tasks = runCiNonWebTests({
    baseRef: 'origin/main',
    eventName: 'pull_request',
    execute: (command, args) => {
      calls.push({ args, command });
      return JSON.stringify({
        tasks: [
          {
            package: '@baci/shared',
            taskId: '@baci/shared#test',
          },
        ],
      });
    },
    runTests: false,
  });

  assert.deepEqual(tasks, [
    { package: '@baci/shared', taskId: '@baci/shared#test' },
  ]);
  assert.deepEqual(calls, [
    {
      args: [
        'turbo',
        'run',
        'test',
        '--concurrency=3',
        '--log-order=stream',
        '--cache=local:rw,remote:r',
        '--filter=...[origin/main]',
        '--filter=!@baci/web',
        '--dry=json',
      ],
      command: 'pnpm',
    },
  ]);
});
