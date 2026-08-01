import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  canonicalFunctionIdentity,
  discoverSql,
  discoverWriterPaths,
  functionDefinitions,
} from './product-description-writer-discovery';

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

  it('preserves parentheses inside SQL parameter types', () => {
    const source = `CREATE OR REPLACE FUNCTION public.save_copy(p_amount numeric(10, 2))
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.products (description) VALUES ('numeric');
END;
$$;`;

    expect(functionDefinitions(source)).toEqual([
      expect.objectContaining({
        signature: 'public.save_copy(p_amount numeric(10, 2))',
      }),
    ]);
  });

  it('discovers quoted and unqualified product description writers', async () => {
    const root = await mkdtemp(join(tmpdir(), 'baci-description-sql-'));
    roots.push(root);
    const migrationRoot = join(root, 'supabase/migrations');
    await mkdir(migrationRoot, { recursive: true });
    await writeFile(
      join(migrationRoot, '20260803000000_quoted_update.sql'),
      'UPDATE "public"."products" SET "description" = \'quoted\';'
    );
    await writeFile(
      join(migrationRoot, '20260804000000_unqualified_insert.sql'),
      "INSERT INTO products (description) VALUES ('unqualified');"
    );

    await expect(discoverSql(root)).resolves.toEqual([
      'supabase/migrations/20260803000000_quoted_update.sql',
      'supabase/migrations/20260804000000_unqualified_insert.sql',
    ]);
  });

  it('canonicalizes renamed arguments and defaults without merging true overloads', () => {
    expect(
      canonicalFunctionIdentity(
        "public.save_copy(p_new_id uuid, p_payload jsonb, p_mode text DEFAULT 'current')"
      )
    ).toBe('public.save_copy(uuid,jsonb,text)');
    expect(canonicalFunctionIdentity('public.save_copy(p_id uuid)')).not.toBe(
      canonicalFunctionIdentity('public.save_copy(p_id text)')
    );
  });

  it('selects the latest body when only SQL argument names and defaults change', async () => {
    const root = await mkdtemp(join(tmpdir(), 'baci-description-sql-'));
    roots.push(root);
    const migrationRoot = join(root, 'supabase/migrations');
    await mkdir(migrationRoot, { recursive: true });
    await writeFile(
      join(migrationRoot, '20260801000000_old_writer.sql'),
      `CREATE OR REPLACE FUNCTION public.save_copy(
  p_id uuid,
  p_mode text DEFAULT 'legacy'
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.products (description) VALUES ('old');
END;
$$;`
    );
    await writeFile(
      join(migrationRoot, '20260802000000_replacement.sql'),
      `CREATE OR REPLACE FUNCTION public.save_copy(
  product_id uuid,
  mode text DEFAULT 'current'
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM product_id, mode;
END;
$$;`
    );

    await expect(discoverSql(root)).resolves.toEqual([]);
  });

  it('discovers only matching source files and ignores their test files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'baci-description-paths-'));
    roots.push(root);
    const writerPath = 'apps/web/src/product-writer.ts';
    await mkdir(join(root, 'apps/web/src'), { recursive: true });
    await writeFile(
      join(root, writerPath),
      "await supabase.from('products').update({ description });"
    );
    await writeFile(join(root, 'apps/web/src/product-writer.test.ts'), '');

    await expect(discoverWriterPaths(root)).resolves.toEqual([writerPath]);
  });

  it('returns no SQL writers when the migrations root is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'baci-description-empty-'));
    roots.push(root);

    await expect(discoverSql(root)).resolves.toEqual([]);
  });
});
