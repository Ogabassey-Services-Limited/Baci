import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverSql } from './product-description-writer-discovery';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('product description SQL discovery', () => {
  it('keeps overloaded SQL functions separate when selecting latest definitions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'baci-description-sql-'));
    roots.push(root);
    const migrationRoot = join(root, 'supabase/migrations');
    await mkdir(migrationRoot, { recursive: true });
    await writeFile(
      join(migrationRoot, '20260801000000_uuid_writer.sql'),
      `CREATE OR REPLACE FUNCTION public.save_copy(p_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.products (description) VALUES ('uuid');
END;
$$;`
    );
    await writeFile(
      join(migrationRoot, '20260802000000_text_writer.sql'),
      `CREATE OR REPLACE FUNCTION public.save_copy(p_id text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM p_id;
END;
$$;`
    );

    await expect(discoverSql(root)).resolves.toEqual([
      'supabase/migrations/20260801000000_uuid_writer.sql',
    ]);
  });
});
