import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('rejects the retired baci-vps label in inline and block runs-on values in yml and yaml workflows', async () => {
  const root = await mkdtemp(join(tmpdir(), 'baci-actionlint-label-'));
  try {
    const workflow = await readFile(
      new URL('../workflows/actionlint.yml', import.meta.url),
      'utf8'
    );
    const script = workflow.match(
      /- name: Check for deprecated runner labels\n {8}run: \|\n([\s\S]+?)\n {6}- name:/
    )?.[1];
    assert.ok(script, 'deprecated-runner script must remain extractable');
    const normalized = script
      .split('\n')
      .map((line) => line.slice(10))
      .join('\n');
    const legacyWorkflows = [
      ['inline.yml', 'jobs:\n  legacy:\n    runs-on: [self-hosted, "baci-vps"]\n'],
      ['block.yml', "jobs:\n  legacy:\n    runs-on:\n      - self-hosted\n      - 'baci-vps'\n"],
      ['inline.yaml', 'jobs:\n  legacy:\n    runs-on: [self-hosted, baci-vps]\n'],
      ['block.yaml', 'jobs:\n  legacy:\n    runs-on:\n      - self-hosted\n      - "baci-vps"\n'],
    ];

    await mkdir(join(root, '.github/workflows'), { recursive: true });
    for (const [filename, contents] of legacyWorkflows) {
      await mkdir(join(root, '.github/workflows'), { recursive: true });
      await writeFile(join(root, '.github/workflows', filename), contents);

      const result = spawnSync('/bin/bash', ['-c', normalized], {
        cwd: root,
        encoding: 'utf8',
      });

      assert.equal(result.status, 1, filename);
      assert.match(result.stdout, /Deprecated runner label 'baci-vps'/, filename);
      await rm(join(root, '.github/workflows', filename));
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('accepts baci-vps in an unrelated YAML list', async () => {
  const root = await mkdtemp(join(tmpdir(), 'baci-actionlint-label-'));
  try {
    const workflow = await readFile(
      new URL('../workflows/actionlint.yml', import.meta.url),
      'utf8'
    );
    const script = workflow.match(
      /- name: Check for deprecated runner labels\n {8}run: \|\n([\s\S]+?)\n {6}- name:/
    )?.[1];
    assert.ok(script, 'deprecated-runner script must remain extractable');
    const normalized = script
      .split('\n')
      .map((line) => line.slice(10))
      .join('\n');
    await mkdir(join(root, '.github/workflows'), { recursive: true });
    await writeFile(
      join(root, '.github/workflows/valid.yaml'),
      'jobs:\n  valid:\n    runs-on: ubuntu-latest\n    labels:\n      - baci-vps\n'
    );

    const result = spawnSync('/bin/bash', ['-c', normalized], {
      cwd: root,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
