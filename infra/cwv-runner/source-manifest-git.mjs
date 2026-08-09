import { execFileSync } from 'node:child_process';

const TRUSTED_GIT = '/usr/bin/git';
function trustedGitEnvironment() {
  const env = {
    PATH: '/usr/bin:/bin',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_ATTR_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    GIT_NO_REPLACE_OBJECTS: '1',
  };
  for (const key of ['HOME', 'LANG', 'LC_ALL', 'TZ']) {
    if (typeof process.env[key] === 'string') env[key] = process.env[key];
  }
  return env;
}

export function git(cwd, args, input, encoding = 'utf8') {
  return execFileSync(TRUSTED_GIT, args, {
    cwd,
    encoding,
    input,
    env: trustedGitEnvironment(),
    timeout: 120_000,
    maxBuffer: 512 * 1024 * 1024,
  });
}
