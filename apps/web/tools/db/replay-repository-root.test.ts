import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { replayRepository } from './replay-repository-root';

async function removeTrees(...targets: string[]) {
  await Promise.all(
    targets.map((target) => rm(target, { force: true, recursive: true }))
  );
}

describe('replayRepositoryRoot', () => {
  it('derives and canonicalizes the monorepo root independently of cwd', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'baci-root-'));
    const aliasRoot = await mkdtemp(path.join(tmpdir(), 'baci-root-alias-'));
    const modulePath = 'apps/web/tools/db';
    try {
      await mkdir(path.join(root, modulePath), { recursive: true });
      await mkdir(path.join(aliasRoot, 'apps/web/tools'), { recursive: true });
      await symlink(
        path.join(root, modulePath),
        path.join(aliasRoot, modulePath)
      );

      expect(replayRepository.root(path.join(aliasRoot, modulePath))).toBe(
        await realpath(root)
      );
    } finally {
      await removeTrees(aliasRoot, root);
    }
  });

  it('requires an absolute module directory', () => {
    expect(() => replayRepository.root('apps/web/tools/db')).toThrow(
      /^Replay module directory must be absolute$/
    );
  });
});

describe('replayRepositoryPath', () => {
  it('resolves stable repository-relative paths', () => {
    expect(
      replayRepository.path(
        '/tmp/example-baci',
        'supabase/migrations/20260101000000_example.sql'
      )
    ).toBe('/tmp/example-baci/supabase/migrations/20260101000000_example.sql');
  });

  it.each([
    '/etc/passwd',
    '../outside',
    'supabase\\config.toml',
  ])('rejects unsafe path %s', (repositoryPath) => {
    expect(() =>
      replayRepository.path('/tmp/example-baci', repositoryPath)
    ).toThrow(/^Unsafe replay repository path$/);
  });
});

describe('replay source filesystem adapter', () => {
  it.each([
    'final',
    'intermediate',
  ] as const)('rejects a %s symlink escape before reading source bytes', async (kind) => {
    const root = await mkdtemp(path.join(tmpdir(), 'baci-source-root-'));
    const workdir = await mkdtemp(path.join(tmpdir(), 'baci-source-work-'));
    const outside = await mkdtemp(path.join(tmpdir(), 'baci-source-outside-'));
    const repositoryPath =
      'supabase/migrations/20260101000000_symlink_escape.sql';
    const body = 'SELECT outside;\n';
    try {
      const outsideSource = path.join(
        outside,
        'migrations',
        path.basename(repositoryPath)
      );
      await mkdir(path.dirname(outsideSource), { recursive: true });
      await writeFile(outsideSource, body);
      if (kind === 'final') {
        const sourcePath = path.join(root, repositoryPath);
        await mkdir(path.dirname(sourcePath), { recursive: true });
        await symlink(outsideSource, sourcePath);
      } else {
        await symlink(outside, path.join(root, 'supabase'));
      }

      await expect(
        replayRepository.copyBootstrapSource(root, workdir, {
          receiptId: `bootstrap:${kind}`,
          repositoryPath,
          sha256: createHash('sha256').update(body).digest('hex'),
        })
      ).rejects.toThrow(/^Unsafe replay source path$/);
    } finally {
      await removeTrees(root, workdir, outside);
    }
  });

  it('rejects bootstrap source drift before writing copied bytes', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'baci-source-root-'));
    const workdir = await mkdtemp(path.join(tmpdir(), 'baci-source-work-'));
    const repositoryPath =
      'supabase/migrations/20260101000000_drifted_bootstrap.sql';
    try {
      const sourcePath = path.join(root, repositoryPath);
      await mkdir(path.dirname(sourcePath), { recursive: true });
      await writeFile(sourcePath, 'SELECT drifted;\n');

      await expect(
        replayRepository.copyBootstrapSource(root, workdir, {
          receiptId: 'bootstrap:drift',
          repositoryPath,
          sha256: createHash('sha256')
            .update('SELECT expected;\n')
            .digest('hex'),
        })
      ).rejects.toThrow(/^Replay source hash mismatch$/);
      await expect(
        readFile(
          path.join(
            workdir,
            'supabase/migrations/20260101000000_drifted_bootstrap.sql'
          )
        )
      ).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await removeTrees(root, workdir);
    }
  });

  it('copies bootstrap sources and writes only hash-bound replay bytes', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'baci-source-root-'));
    const workdir = await mkdtemp(path.join(tmpdir(), 'baci-source-work-'));
    const repositoryPath =
      'supabase/migrations/20260101000000_replay_source.sql';
    const original = 'SELECT old_value;\n';
    const output = 'SELECT new_value;\n';
    const sha256 = (value: string) =>
      createHash('sha256').update(value).digest('hex');
    try {
      const sourcePath = path.join(root, repositoryPath);
      await mkdir(path.dirname(sourcePath), { recursive: true });
      await writeFile(sourcePath, original);
      await replayRepository.copyBootstrapSource(root, workdir, {
        receiptId: 'bootstrap:1',
        repositoryPath,
        sha256: sha256(original),
      });
      await expect(
        readFile(
          path.join(
            workdir,
            'supabase/migrations/20260101000000_replay_source.sql'
          ),
          'utf8'
        )
      ).resolves.toBe(original);

      const target = await replayRepository.materializeSource(
        root,
        workdir,
        {
          receiptId: 'transform:1',
          repositoryPath,
          sha256: sha256(original),
          transform: {
            originalSha256: sha256(original),
            outputSha256: sha256(output),
            replacement: 'new_value',
            search: 'old_value',
          },
        },
        126
      );
      await expect(readFile(target, 'utf8')).resolves.toBe(output);
      await expect(
        replayRepository.materializeSource(
          root,
          workdir,
          {
            receiptId: 'drift:1',
            repositoryPath,
            sha256: 'f'.repeat(64),
          },
          127
        )
      ).rejects.toThrow(/^Replay source hash mismatch$/);
    } finally {
      await removeTrees(root, workdir);
    }
  });
});

describe('resolveReplayOutputPath', () => {
  it('accepts an ordinary canonical in-repository output path', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'baci-output-root-'));
    try {
      await mkdir(path.join(root, 'fixtures'));

      const output = await replayRepository.output(
        root,
        'fixtures/result.json'
      );
      expect(output).toMatchObject({
        path: path.join(await realpath(root), 'fixtures/result.json'),
      });
      await output.create('safe');
      await expect(output.read('utf8')).resolves.toBe('safe');
      await output.replace('updated');
      await expect(output.read('utf8')).resolves.toBe('updated');
      await rm(output.path);
      await mkdir(output.path);
      await expect(output.replace('blocked')).rejects.toThrow(
        /^Replay output replace failed$/
      );
      expect(await readdir(path.dirname(output.path))).toEqual(['result.json']);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('rejects an existing final output symlink', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'baci-output-root-'));
    const outside = await mkdtemp(path.join(tmpdir(), 'baci-output-outside-'));
    try {
      await mkdir(path.join(root, 'fixtures'));
      const outsideFile = path.join(outside, 'result.json');
      await writeFile(outsideFile, 'outside');
      await symlink(outsideFile, path.join(root, 'fixtures/result.json'));

      await expect(
        replayRepository.output(root, 'fixtures/result.json')
      ).rejects.toThrow(/^Unsafe replay output path$/);
    } finally {
      await removeTrees(root, outside);
    }
  });

  it('revalidates the canonical parent immediately before create', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'baci-output-root-'));
    const outside = await mkdtemp(path.join(tmpdir(), 'baci-output-outside-'));
    try {
      const parent = path.join(root, 'fixtures');
      await mkdir(parent);
      const output = await replayRepository.output(
        root,
        'fixtures/result.json'
      );
      await rm(parent, { recursive: true });
      await symlink(outside, parent);

      await expect(output.create('unsafe')).rejects.toThrow(
        /^Unsafe replay output path$/
      );
      await expect(
        readFile(path.join(outside, 'result.json'))
      ).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await removeTrees(root, outside);
    }
  });

  it('rejects a symlinked parent that escapes the repository', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'baci-output-root-'));
    const outside = await mkdtemp(path.join(tmpdir(), 'baci-output-outside-'));
    try {
      await symlink(outside, path.join(root, 'escape'));
      await expect(
        replayRepository.output(root, 'escape/fixture.json')
      ).rejects.toThrow(/^Unsafe replay output path$/);
    } finally {
      await removeTrees(root, outside);
    }
  });
});
