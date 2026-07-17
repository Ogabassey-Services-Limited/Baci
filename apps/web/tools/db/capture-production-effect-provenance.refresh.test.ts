import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { captureProductionEffectProvenance } from './capture-production-effect-provenance';
import { supabaseHistoryReplayManifest } from './supabase-history-replay-manifest';

const workspaceRoot = path.resolve(import.meta.dirname, '../../../..');
const roots: string[] = [];

type SemanticLine =
  | {
      kind: 'migration';
      marker: string;
      name: string;
      version: string;
    }
  | {
      applied: number;
      kind: 'summary';
      marker: string;
      skipped: number;
    };

function rawLog(lines: SemanticLine[]): string {
  return lines
    .map((line) => {
      if (line.kind === 'summary') {
        return `${line.marker} ${line.applied} applied, ${line.skipped} skipped.\n`;
      }
      const spaces =
        line.marker === '→ applying:'
          ? '        '
          : line.marker === '✓ applied:'
            ? '         '
            : ' ';
      return `${line.marker}${spaces}${line.version}  ${line.name}\n`;
    })
    .join('');
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('captureProductionEffectProvenance refresh mode', () => {
  it('rebuilds a stale semantic fixture from exact receipt inputs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'baci-semantic-refresh-'));
    roots.push(root);
    const fixtureDirectory = path.join(
      workspaceRoot,
      'apps/web/tools/db/fixtures'
    );
    await cp(fixtureDirectory, path.join(root, 'apps/web/tools/db/fixtures'), {
      recursive: true,
    });
    const expectedBytes = await readFile(
      path.join(fixtureDirectory, 'github-migration-semantic-lines.json'),
      'utf8'
    );
    const semantic = JSON.parse(expectedBytes) as {
      sources: Array<{
        databaseJobId: number;
        deploymentRunId: number;
        kind: 'corroboration' | 'primary';
        lines: SemanticLine[];
      }>;
    };
    const outputPath = supabaseHistoryReplayManifest.semanticFixture.path;
    await writeFile(path.join(root, outputPath), '{"stale":true}\n');

    await captureProductionEffectProvenance(
      {
        refreshFixture: true,
        semanticFixtureOutput: outputPath,
        workspaceRoot: root,
      },
      {
        readJob: async (source) => {
          const captured = semantic.sources.find(
            (candidate) =>
              candidate.deploymentRunId === source.deploymentRunId &&
              candidate.databaseJobId === source.databaseJobId &&
              candidate.kind === source.kind
          );
          if (!captured) throw new Error('Expected semantic source');
          return {
            conclusion: source.expectedConclusion,
            databaseJobId: source.databaseJobId,
            deploymentRunId: source.deploymentRunId,
            headSha: source.headSha,
            rawLog: rawLog(captured.lines),
            repository: 'ogabasseyy/Baci',
          };
        },
      }
    );

    expect(await readFile(path.join(root, outputPath), 'utf8')).toBe(
      expectedBytes
    );
  });

  it('preserves the stale fixture when a semantic source read fails', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'baci-semantic-refresh-'));
    roots.push(root);
    const fixtureDirectory = path.join(
      workspaceRoot,
      'apps/web/tools/db/fixtures'
    );
    await cp(fixtureDirectory, path.join(root, 'apps/web/tools/db/fixtures'), {
      recursive: true,
    });
    const outputPath = supabaseHistoryReplayManifest.semanticFixture.path;
    const staleBytes = '{"stale":true}\n';
    await writeFile(path.join(root, outputPath), staleBytes);

    await expect(
      captureProductionEffectProvenance(
        {
          refreshFixture: true,
          semanticFixtureOutput: outputPath,
          workspaceRoot: root,
        },
        {
          readJob: async () => {
            throw new Error('Semantic source read failed');
          },
        }
      )
    ).rejects.toThrow('Semantic source read failed');

    expect(await readFile(path.join(root, outputPath), 'utf8')).toBe(
      staleBytes
    );
  });
});
