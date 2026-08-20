import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const runner = new URL('./run-lefthook-pnpm.sh', import.meta.url);
const wrapper = new URL('./hook-bin/pnpm', import.meta.url);

test('routes sparse install commands through allowUnusedPatches', () => {
  const temp = mkdtempSync(join(tmpdir(), 'baci-hook-pnpm-'));
  const log = join(temp, 'pnpm.log');
  const fakePnpm = join(temp, 'real-pnpm');
  writeFileSync(
    fakePnpm,
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${log}"
exit 0
`,
    { mode: 0o755 }
  );

  const result = spawnSync(
    '/bin/bash',
    [
      '-c',
      `export BACI_REAL_PNPM='${fakePnpm}'
exec '${wrapper.pathname}' install --frozen-lockfile`,
    ],
    {
      cwd: new URL('..', import.meta.url).pathname,
      env: {
        ...process.env,
        PATH: '/usr/bin:/bin',
      },
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr);
  const output = readFileSync(log, 'utf8').trim();
  if (
    spawnSync(
      'sh',
      [new URL('./is-sparse-checkout.sh', import.meta.url).pathname],
      {
        cwd: new URL('..', import.meta.url).pathname,
        encoding: 'utf8',
      }
    ).status === 0
  ) {
    assert.match(
      output,
      /^--config\.allowUnusedPatches=true install --frozen-lockfile$/
    );
  } else {
    assert.match(output, /^install --frozen-lockfile$/);
  }
});

test('routes sparse non-install commands through verifyDepsBeforeRun=false', () => {
  const temp = mkdtempSync(join(tmpdir(), 'baci-hook-pnpm-'));
  const log = join(temp, 'pnpm.log');
  const fakePnpm = join(temp, 'real-pnpm');
  writeFileSync(
    fakePnpm,
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${log}"
exit 0
`,
    { mode: 0o755 }
  );

  const repoRoot = new URL('..', import.meta.url).pathname;
  const result = spawnSync(
    '/bin/bash',
    [
      '-c',
      `export BACI_REAL_PNPM='${fakePnpm}'
exec '${wrapper.pathname}' knip`,
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        PATH: '/usr/bin:/bin',
      },
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr);
  const output = readFileSync(log, 'utf8').trim();
  if (
    spawnSync(
      'sh',
      [new URL('./is-sparse-checkout.sh', import.meta.url).pathname],
      {
        cwd: repoRoot,
        encoding: 'utf8',
      }
    ).status === 0
  ) {
    assert.match(output, /^--config\.verifyDepsBeforeRun=false knip$/);
  } else {
    assert.match(output, /^knip$/);
  }
});

function runRunnerWithPuppeteerEnvironment(overrides = {}) {
  const temp = mkdtempSync(join(tmpdir(), 'baci-hook-pnpm-'));
  const log = join(temp, 'pnpm-env.log');
  const fakePnpm = join(temp, 'pnpm');
  writeFileSync(
    fakePnpm,
    `#!/usr/bin/env bash
printf '%s\\n' \\
  "PUPPETEER_SKIP_DOWNLOAD=\${PUPPETEER_SKIP_DOWNLOAD-}" \\
  "PUPPETEER_CHROME_SKIP_DOWNLOAD=\${PUPPETEER_CHROME_SKIP_DOWNLOAD-}" \\
  "PUPPETEER_CHROME_HEADLESS_SHELL_SKIP_DOWNLOAD=\${PUPPETEER_CHROME_HEADLESS_SHELL_SKIP_DOWNLOAD-}" \\
  "PUPPETEER_SKIP_CHROME_HEADLESS_SHELL_DOWNLOAD=\${PUPPETEER_SKIP_CHROME_HEADLESS_SHELL_DOWNLOAD-}" > "${log}"
`,
    { mode: 0o755 }
  );

  const env = {
    ...process.env,
    PATH: `${temp}:/usr/bin:/bin`,
  };
  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete env[name];
    } else {
      env[name] = String(value);
    }
  }
  const result = spawnSync('/bin/bash', [runner.pathname, 'verify'], {
    cwd: new URL('..', import.meta.url).pathname,
    env,
    encoding: 'utf8',
  });

  return { log, result };
}

function assertPuppeteerEnvironment(log, expected) {
  assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n'), [
    `PUPPETEER_SKIP_DOWNLOAD=${expected.skipDownload}`,
    `PUPPETEER_CHROME_SKIP_DOWNLOAD=${expected.chromeSkipDownload}`,
    `PUPPETEER_CHROME_HEADLESS_SHELL_SKIP_DOWNLOAD=${expected.chromeHeadlessShellSkipDownload}`,
    `PUPPETEER_SKIP_CHROME_HEADLESS_SHELL_DOWNLOAD=${expected.skipChromeHeadlessShellDownload}`,
  ]);
}

test('propagates Puppeteer download defaults to the pnpm child process', () => {
  const variables = [
    'PUPPETEER_SKIP_DOWNLOAD',
    'PUPPETEER_CHROME_SKIP_DOWNLOAD',
    'PUPPETEER_CHROME_HEADLESS_SHELL_SKIP_DOWNLOAD',
    'PUPPETEER_SKIP_CHROME_HEADLESS_SHELL_DOWNLOAD',
  ];
  const { log, result } = runRunnerWithPuppeteerEnvironment(
    Object.fromEntries(variables.map((name) => [name, undefined]))
  );

  assert.equal(result.status, 0, result.stderr);
  assertPuppeteerEnvironment(log, {
    skipDownload: 'true',
    chromeSkipDownload: 'true',
    chromeHeadlessShellSkipDownload: 'true',
    skipChromeHeadlessShellDownload: 'true',
  });
});

test('preserves caller-provided Puppeteer download settings', () => {
  const { log, result } = runRunnerWithPuppeteerEnvironment({
    PUPPETEER_SKIP_DOWNLOAD: 'false',
    PUPPETEER_CHROME_SKIP_DOWNLOAD: 'false',
    PUPPETEER_CHROME_HEADLESS_SHELL_SKIP_DOWNLOAD: 'false',
    PUPPETEER_SKIP_CHROME_HEADLESS_SHELL_DOWNLOAD: 'false',
  });

  assert.equal(result.status, 0, result.stderr);
  assertPuppeteerEnvironment(log, {
    skipDownload: 'false',
    chromeSkipDownload: 'false',
    chromeHeadlessShellSkipDownload: 'false',
    skipChromeHeadlessShellDownload: 'false',
  });
});
