import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    '../../supabase/migrations/20260805090000_add_least_privilege_gigl_tracking_worker.sql'
  ),
  'utf8'
);

describe('GIGL tracking worker capability migration', () => {
  it('creates a non-login role that cannot bypass RLS', () => {
    expect(migration).toMatch(
      /CREATE ROLE gigl_tracking_worker NOLOGIN NOINHERIT NOSUPERUSER\s+NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS/
    );
  });

  it('grants only the five tracking wrapper procedures to the worker role', () => {
    const grants = migration.match(
      /GRANT EXECUTE ON FUNCTION public\.gigl_worker_[\s\S]*?TO gigl_tracking_worker;/g
    );

    expect(grants).toHaveLength(5);
    expect(migration).not.toMatch(
      /GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL).*TO gigl_tracking_worker/
    );
  });

  it('authenticates every wrapper before elevating the bounded call', () => {
    expect(
      migration.match(
        /IF auth\.role\(\) IS DISTINCT FROM 'gigl_tracking_worker'/g
      )
    ).toHaveLength(5);
    expect(
      migration.match(
        /set_config\('request\.jwt\.claim\.role', 'service_role', true\)/g
      )
    ).toHaveLength(5);
  });
});
