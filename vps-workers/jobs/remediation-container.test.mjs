import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const workerRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('remediation container', () => {
  it('uses a glibc image compatible with mounted VPS dependencies', () => {
    const dockerfile = readFileSync(
      join(workerRoot, 'Dockerfile.codex-remediator'),
      'utf8'
    );

    assert.match(dockerfile, /^FROM node:24-bookworm-slim@sha256:/);
    assert.doesNotMatch(dockerfile, /alpine|apk add/);
  });

  it('excludes staged environment secrets from the Docker build context', () => {
    const dockerignore = readFileSync(
      join(workerRoot, '.dockerignore'),
      'utf8'
    );

    assert.match(dockerignore, /^\.env$/m);
    assert.match(dockerignore, /^\.env\.\*$/m);
  });
});
