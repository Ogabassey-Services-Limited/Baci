import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT_PATH = path.join(__dirname, 'check-module-size.mjs');
const tempDirs = new Set<string>();

function createFixture(files: Record<string, string>) {
  const root = path.join(
    os.tmpdir(),
    `storefront-module-size-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  tempDirs.add(root);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
  }

  return root;
}

function createLines(count: number) {
  return Array.from({ length: count }, (_, index) => `line ${index + 1}`).join('\n');
}

function createBaseline(entries: Array<{ lineCount: number; path: string }>) {
  return JSON.stringify({
    maxLines: 300,
    modules: entries.map((entry) => ({
      ...entry,
      justification: 'Existing oversized module baseline.',
    })),
    roots: ['components', 'hooks', 'lib', 'services', 'stores'],
  });
}

function runModuleSizeCheck(projectRoot: string) {
  return spawnSync(process.execPath, [SCRIPT_PATH, '--project-root', projectRoot], {
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const tempDir of tempDirs) {
    rmSync(tempDir, { force: true, recursive: true });
  }
  tempDirs.clear();
});

describe('check-module-size', () => {
  it('passes when oversized modules stay within their recorded baseline', () => {
    const root = createFixture({
      'components/checkout.tsx': createLines(340),
      'config/module-size-baseline.json': createBaseline([
        { path: 'components/checkout.tsx', lineCount: 340 },
      ]),
    });

    const result = runModuleSizeCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[module-size] OK');
    expect(result.stdout).toContain('1 oversized module baseline');
  });

  it('fails when a new module exceeds the max line budget', () => {
    const root = createFixture({
      'components/new-module.tsx': createLines(301),
      'config/module-size-baseline.json': createBaseline([]),
    });

    const result = runModuleSizeCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('New oversized module files');
    expect(result.stderr).toContain('components/new-module.tsx: 301 lines');
  });

  it('fails when a baselined module grows beyond its recorded line count', () => {
    const root = createFixture({
      'components/checkout.tsx': createLines(321),
      'config/module-size-baseline.json': createBaseline([
        { path: 'components/checkout.tsx', lineCount: 320 },
      ]),
    });

    const result = runModuleSizeCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Oversized modules grew past their baseline');
    expect(result.stderr).toContain('components/checkout.tsx: 321 lines > 320 baseline');
  });

  it('fails when a baselined module shrinks but remains oversized', () => {
    const root = createFixture({
      'components/checkout.tsx': createLines(320),
      'config/module-size-baseline.json': createBaseline([
        { path: 'components/checkout.tsx', lineCount: 340 },
      ]),
    });

    const result = runModuleSizeCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Oversized modules shrank but their baselines were not lowered'
    );
    expect(result.stderr).toContain(
      'components/checkout.tsx: now 320 lines, lower the baseline from 340'
    );
  });

  it('ignores test files in monitored roots', () => {
    const root = createFixture({
      'components/ignored.test.tsx': createLines(800),
      'config/module-size-baseline.json': createBaseline([]),
    });

    const result = runModuleSizeCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[module-size] OK: 0 oversized module baselines');
  });

  it('fails when baseline entry file is missing', () => {
    const root = createFixture({
      'components/existing.tsx': createLines(20),
      'config/module-size-baseline.json': createBaseline([
        { path: 'components/deleted.tsx', lineCount: 320 },
      ]),
    });

    const result = runModuleSizeCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Stale module-size baseline entries');
    expect(result.stderr).toContain('components/deleted.tsx: file is missing');
  });
});
