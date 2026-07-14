// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Turbo runs with strict env filtering, so an env var that is not declared in
 * `globalPassThroughEnv` is simply ABSENT from the build environment — the knob
 * silently does nothing, with no error anywhere. We shipped exactly that bug
 * twice (TIMEOUT_MS, DISTRUST_MS).
 *
 * This derives the required list from the SOURCE rather than restating it, so a
 * new knob cannot be added without turbo.json being updated in the same change.
 */
describe('remote cache env knobs', () => {
  const cacheDir = __dirname;
  const repoRoot = path.resolve(cacheDir, '../../../../..');

  function envVarsReadBySource(): string[] {
    const found = new Set<string>();
    for (const file of readdirSync(cacheDir)) {
      if (!file.endsWith('.mjs')) continue;
      const source = readFileSync(path.join(cacheDir, file), 'utf8');
      for (const match of source.matchAll(/BACI_REMOTE_CACHE_[A-Z_]+/g)) {
        found.add(match[0]);
      }
    }
    return [...found].sort();
  }

  it('declares every knob the source reads in turbo.json globalPassThroughEnv', () => {
    const turbo = JSON.parse(
      readFileSync(path.join(repoRoot, 'turbo.json'), 'utf8')
    ) as { globalPassThroughEnv?: string[] };
    const declared = new Set(turbo.globalPassThroughEnv ?? []);

    const missing = envVarsReadBySource().filter((name) => !declared.has(name));

    expect(missing).toEqual([]);
  });

  it('actually reads the knobs it documents (guards against a dead constant)', () => {
    const read = envVarsReadBySource();

    expect(read).toContain('BACI_REMOTE_CACHE_TIMEOUT_MS');
    expect(read).toContain('BACI_REMOTE_CACHE_DISTRUST_MS');
  });
});
