import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  parseMeasurementArgs,
  writeMeasurementReport,
} from './measure-vercel-storefront-cost-cli';

const sha = 'a'.repeat(40);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true }))
  );
});

describe('parseMeasurementArgs', () => {
  it('parses required and optional before/after windows', () => {
    const result = parseMeasurementArgs([
      '--project-id',
      'prj_example',
      '--before',
      'before.jsonl',
      '--before-sha',
      sha,
      '--before-db-trace',
      'before-db.jsonl',
      '--after',
      'after.jsonl',
      '--after-sha',
      'b'.repeat(40),
      '--after-window-start',
      '2026-08-01T00:00:00.000Z',
      '--after-window-end',
      '2026-09-01T00:00:00.000Z',
      '--out',
      'measurement.json',
    ]);

    expect(result.projectId).toBe('prj_example');
    expect(result.before.inputPath).toBe('before.jsonl');
    expect(result.before.window.dbTracePath).toBe('before-db.jsonl');
    expect(result.after?.window.requestedWindowStart).toBe(
      '2026-08-01T00:00:00.000Z'
    );
    expect(result.outputPath).toBe('measurement.json');
  });

  it('requires an after SHA when an after export is supplied', () => {
    expect(() =>
      parseMeasurementArgs([
        '--project-id',
        'prj_example',
        '--before',
        'before.jsonl',
        '--before-sha',
        sha,
        '--after',
        'after.jsonl',
      ])
    ).toThrow('--after-sha is required with --after');
  });

  it('rejects after-window options when no after export is supplied', () => {
    expect(() =>
      parseMeasurementArgs([
        '--project-id',
        'prj_example',
        '--before',
        'before.jsonl',
        '--before-sha',
        sha,
        '--after-sha',
        'b'.repeat(40),
      ])
    ).toThrow('--after is required with --after-* options');
  });

  it.each([
    '--before-unknown',
    '--after-unknown',
  ])('rejects unsupported %s options instead of ignoring them', (unknownOption) => {
    expect(() =>
      parseMeasurementArgs([
        '--project-id',
        'prj_example',
        '--before',
        'before.jsonl',
        '--before-sha',
        sha,
        unknownOption,
        'value',
      ])
    ).toThrow(`unknown measurement option: ${unknownOption}`);
  });

  it('replaces an existing permissive output with a private report file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vercel-cost-report-'));
    roots.push(root);
    const outputPath = join(root, 'measurement.json');
    await writeFile(outputPath, 'old', { mode: 0o644 });
    await chmod(outputPath, 0o644);

    await writeMeasurementReport(outputPath, '{"safe":true}\n');

    expect(await readFile(outputPath, 'utf8')).toBe('{"safe":true}\n');
    expect((await stat(outputPath)).mode & 0o777).toBe(0o600);
  });
});
