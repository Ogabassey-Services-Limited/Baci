import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseManagementReadOnlyExecutor } from './create-supabase-management-read-only-executor';

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-management-read-only-'));
  roots.push(root);
  return root;
}

async function writeProjectRef(root: string, projectRef: string) {
  const tempDirectory = path.join(root, 'supabase/.temp');
  await mkdir(tempDirectory, { recursive: true });
  await writeFile(path.join(tempDirectory, 'project-ref'), projectRef);
}

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('createSupabaseManagementReadOnlyExecutor', () => {
  it('posts a query to the linked project read-only endpoint', async () => {
    const root = await temporaryRoot();
    const token = 'management-secret';
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify([{ version: '20260718070000' }]))
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('SUPABASE_ACCESS_TOKEN', token);
    vi.stubEnv('SUPABASE_PROJECT_REF', 'abcdefghijklmnopqrst');
    vi.stubGlobal('fetch', fetchMock);

    const executeSelect = await createSupabaseManagementReadOnlyExecutor(root);
    const result = await executeSelect('SELECT version FROM migrations');

    expect(result).toEqual([{ version: '20260718070000' }]);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/database/query/read-only',
      {
        body: JSON.stringify({ query: 'SELECT version FROM migrations' }),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: expect.any(AbortSignal),
      }
    );
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('falls back to the trimmed linked project-ref file', async () => {
    const root = await temporaryRoot();
    await writeProjectRef(root, 'abcdefghijklmnopqrst\n');
    const fetchMock = vi.fn(async () => new Response('[]'));
    vi.stubEnv('SUPABASE_ACCESS_TOKEN', 'secret');
    vi.stubEnv('SUPABASE_PROJECT_REF', undefined);
    vi.stubGlobal('fetch', fetchMock);

    const executeSelect = await createSupabaseManagementReadOnlyExecutor(root);
    await executeSelect('SELECT 1');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/projects/abcdefghijklmnopqrst/'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('requires a management token before resolving the project', async () => {
    const root = await temporaryRoot();
    vi.stubEnv('SUPABASE_ACCESS_TOKEN', undefined);
    vi.stubEnv('SUPABASE_PROJECT_REF', 'abcdefghijklmnopqrst');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createSupabaseManagementReadOnlyExecutor(root)
    ).rejects.toThrow('SUPABASE_ACCESS_TOKEN is required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['short', 'abcdefghijklmnopqrs'],
    ['uppercase', 'ABCDEFGHIJKLMNOPQRST'],
    ['punctuation', 'abcdefghijklmnopqrs-'],
  ])('rejects an invalid %s project ref', async (_label, projectRef) => {
    const root = await temporaryRoot();
    vi.stubEnv('SUPABASE_ACCESS_TOKEN', 'secret');
    vi.stubEnv('SUPABASE_PROJECT_REF', projectRef);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createSupabaseManagementReadOnlyExecutor(root)
    ).rejects.toThrow('Linked Supabase project reference is unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sanitizes transport failures without exposing credentials', async () => {
    const root = await temporaryRoot();
    const token = 'management-secret';
    vi.stubEnv('SUPABASE_ACCESS_TOKEN', token);
    vi.stubEnv('SUPABASE_PROJECT_REF', 'abcdefghijklmnopqrst');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error(`socket failed with ${token}`);
      })
    );

    const executeSelect = await createSupabaseManagementReadOnlyExecutor(root);
    const rejection = executeSelect('SELECT private_value');

    await expect(rejection).rejects.toThrow(
      'Supabase management query transport failed'
    );
    await expect(rejection).rejects.not.toThrow(token);
    await expect(rejection).rejects.not.toThrow('private_value');
  });

  it('sanitizes response-body transport failures', async () => {
    const root = await temporaryRoot();
    const token = 'management-secret';
    const body = new ReadableStream({
      start(controller) {
        controller.error(new Error(`body failed with ${token}`));
      },
    });
    vi.stubEnv('SUPABASE_ACCESS_TOKEN', token);
    vi.stubEnv('SUPABASE_PROJECT_REF', 'abcdefghijklmnopqrst');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body))
    );

    const executeSelect = await createSupabaseManagementReadOnlyExecutor(root);
    const rejection = executeSelect('SELECT private_value');

    await expect(rejection).rejects.toThrow(
      'Supabase management query transport failed'
    );
    await expect(rejection).rejects.not.toThrow(token);
    await expect(rejection).rejects.not.toThrow('private_value');
  });

  it('cancels an oversized streamed response before reading the remainder', async () => {
    const root = await temporaryRoot();
    let pulls = 0;
    let cancelled = false;
    const body = new ReadableStream(
      {
        cancel() {
          cancelled = true;
        },
        pull(controller) {
          pulls += 1;
          if (pulls <= 10) controller.enqueue(new Uint8Array(1024 * 1024));
          else controller.close();
        },
      },
      { highWaterMark: 0 }
    );
    vi.stubEnv('SUPABASE_ACCESS_TOKEN', 'management-secret');
    vi.stubEnv('SUPABASE_PROJECT_REF', 'abcdefghijklmnopqrst');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body))
    );

    const executeSelect = await createSupabaseManagementReadOnlyExecutor(root);

    await expect(executeSelect('SELECT 1')).rejects.toThrow(
      'Supabase management query failed'
    );
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(9);
  });

  it.each([
    ['non-ok', new Response('upstream secret', { status: 500 })],
    [
      'oversized',
      new Response(Buffer.alloc(8 * 1024 * 1024 + 1, 'x'.charCodeAt(0))),
    ],
  ])('rejects a %s response with a sanitized error', async (_label, response) => {
    const root = await temporaryRoot();
    vi.stubEnv('SUPABASE_ACCESS_TOKEN', 'management-secret');
    vi.stubEnv('SUPABASE_PROJECT_REF', 'abcdefghijklmnopqrst');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response)
    );

    const executeSelect = await createSupabaseManagementReadOnlyExecutor(root);

    await expect(executeSelect('SELECT 1')).rejects.toThrow(
      'Supabase management query failed'
    );
  });

  it.each([
    ['invalid JSON', 'not-json'],
    ['non-array JSON', JSON.stringify({ rows: [] })],
  ])('rejects %s without returning the response body', async (_label, body) => {
    const root = await temporaryRoot();
    vi.stubEnv('SUPABASE_ACCESS_TOKEN', 'management-secret');
    vi.stubEnv('SUPABASE_PROJECT_REF', 'abcdefghijklmnopqrst');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body))
    );

    const executeSelect = await createSupabaseManagementReadOnlyExecutor(root);

    await expect(executeSelect('SELECT 1')).rejects.toThrow(
      'Supabase management query response was invalid'
    );
  });
});
