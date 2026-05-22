import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT_PATH = path.join(__dirname, 'check-route-size.mjs');
const tempDirs = new Set<string>();

function createFixture(files: Record<string, string>) {
  const root = path.join(
    os.tmpdir(),
    `storefront-route-size-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
    routes: entries.map((entry) => ({
      ...entry,
      justification: 'Existing Phase 6 oversized route baseline.',
    })),
  });
}

function runRouteSizeCheck(projectRoot: string) {
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

describe('check-route-size', () => {
  it('passes when oversized routes stay within their recorded baseline', () => {
    const root = createFixture({
      'app/checkout.tsx': createLines(340),
      'config/route-size-baseline.json': createBaseline([
        { path: 'app/checkout.tsx', lineCount: 340 },
      ]),
    });

    const result = runRouteSizeCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[route-size] OK');
    expect(result.stdout).toContain('1 oversized route baseline');
  });

  it('fails when a baselined route shrinks but remains oversized', () => {
    const root = createFixture({
      'app/checkout.tsx': createLines(320),
      'config/route-size-baseline.json': createBaseline([
        { path: 'app/checkout.tsx', lineCount: 340 },
      ]),
    });

    const result = runRouteSizeCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Oversized routes shrank but their baselines were not lowered'
    );
    expect(result.stderr).toContain(
      'app/checkout.tsx: now 320 lines, lower the baseline from 340'
    );
  });

  it('fails when a new route exceeds the max line budget', () => {
    const root = createFixture({
      'app/new-route.tsx': createLines(301),
      'config/route-size-baseline.json': createBaseline([]),
    });

    const result = runRouteSizeCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('New oversized route files');
    expect(result.stderr).toContain('app/new-route.tsx: 301 lines');
    expect(result.stderr).toContain('Extract route-owned UI or add an intentional baseline');
  });

  it('fails when a baselined route grows beyond its recorded line count', () => {
    const root = createFixture({
      'app/checkout.tsx': createLines(321),
      'config/route-size-baseline.json': createBaseline([
        { path: 'app/checkout.tsx', lineCount: 320 },
      ]),
    });

    const result = runRouteSizeCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Oversized routes grew past their baseline');
    expect(result.stderr).toContain('app/checkout.tsx: 321 lines > 320 baseline');
  });

  it('fails when a baseline entry no longer points to a route file', () => {
    const root = createFixture({
      'app/index.tsx': createLines(20),
      'config/route-size-baseline.json': createBaseline([
        { path: 'app/deleted.tsx', lineCount: 320 },
      ]),
    });

    const result = runRouteSizeCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Stale route-size baseline entries');
    expect(result.stderr).toContain('app/deleted.tsx: file is missing');
  });

  it('fails when a baselined route shrinks under the max line budget', () => {
    const root = createFixture({
      'app/checkout.tsx': createLines(300),
      'config/route-size-baseline.json': createBaseline([
        { path: 'app/checkout.tsx', lineCount: 320 },
      ]),
    });

    const result = runRouteSizeCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Stale route-size baseline entries');
    expect(result.stderr).toContain('app/checkout.tsx: now 300 lines, remove the baseline entry');
  });

  it('reports malformed baseline JSON', () => {
    const root = createFixture({
      'app/index.tsx': createLines(20),
      'config/route-size-baseline.json': '{not json',
    });

    const result = runRouteSizeCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Malformed baseline file');
  });
});
