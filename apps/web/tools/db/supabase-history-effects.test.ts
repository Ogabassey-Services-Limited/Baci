import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { supabaseHistoryEffectScope } from './supabase-history-effect-scope';

const sqlPath = path.resolve(
  import.meta.dirname,
  'supabase-history-effects.sql'
);

async function readSql(): Promise<string> {
  return readFile(sqlPath, 'utf8');
}

describe('supabase-history-effects.sql', () => {
  it('is one bounded SELECT-only PostgreSQL 17.6 component snapshot', async () => {
    const sql = await readSql();

    expect(sql.split('\n').length).toBeLessThanOrEqual(300);
    expect(sql.trimStart()).toMatch(/^WITH\b/);
    expect(sql.trimEnd()).toMatch(/;\s*$/);
    expect(sql.trimEnd().slice(0, -1)).not.toContain(';');
    expect(sql).toContain("'scopeVersion','baci-p0-effects-v3'");
    expect(sql).toContain("current_setting('server_version_num')::int");
    expect(sql).not.toMatch(
      /^\s*(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT|REVOKE|CALL|DO)\b/im
    );
  });

  it('uses exact public event relations instead of whole-schema capture', async () => {
    const sql = await readSql();

    for (const relation of supabaseHistoryEffectScope.eventPipeline.tables) {
      const [schema, name] = relation.split('.');
      expect(sql).toContain(`('${schema}','${name}')`);
    }
    expect(sql).not.toContain("ARRAY['eventing','private','public']");
    expect(sql).not.toMatch(/nspname\s*=\s*ANY/i);
    expect(sql).not.toContain("'ownedSchemas'");
  });

  it('discovers every allowlisted function name and emits every overload identity', async () => {
    const sql = await readSql();
    const functions = {
      ...supabaseHistoryEffectScope.eventPipeline.internalFunctions,
      ...supabaseHistoryEffectScope.eventPipeline.publicRpcs,
      ...supabaseHistoryEffectScope.fulfillmentCancellation.functions,
      ...supabaseHistoryEffectScope.duplicateHistoryFunctions,
    };

    for (const qualifiedName of Object.keys(functions)) {
      const [schema, name] = qualifiedName.split('.');
      expect(sql).toContain(`('${schema}','${name}')`);
    }
    expect(sql).toContain('pg_get_function_identity_arguments(p.oid)');
    expect(sql).toContain('pg_get_function_arguments(p.oid)');
    expect(sql).toContain('pg_get_function_result(p.oid)');
    expect(sql).toContain('pg_get_functiondef(p.oid)');
    expect(sql).toContain("acldefault('f',p.proowner)");
    expect(sql).toContain("'owner',pg_get_userbyid(p.proowner)");
  });

  it('binds exact external contracts and preserves ordinal semantics', async () => {
    const sql = await readSql();
    const external = supabaseHistoryEffectScope.eventPipeline.externalContracts;
    for (const identity of [
      ...external.columns,
      ...external.indexes,
      ...external.policies,
      ...external.triggers,
      ...supabaseHistoryEffectScope.fulfillmentCancellation.columns,
      ...supabaseHistoryEffectScope.fulfillmentCancellation.constraints,
      ...supabaseHistoryEffectScope.fulfillmentCancellation.triggers,
    ]) {
      for (const part of identity.split('.'))
        expect(sql).toContain(`'${part}'`);
    }
    const eventRelations = sql.slice(
      sql.indexOf('event_relation_components AS'),
      sql.indexOf('function_components AS')
    );
    const selectedColumns = sql.slice(
      sql.indexOf('selected_column_components AS'),
      sql.indexOf('constraint_components AS')
    );
    expect(eventRelations).toContain("'ordinal',a.attnum");
    expect(selectedColumns).not.toContain("'ordinal'");
    const policies = sql.slice(
      sql.indexOf('policy_components AS'),
      sql.indexOf('trigger_components AS')
    );
    expect(policies).toContain("'enabled',c.relrowsecurity");
    expect(policies).toContain("'forced',c.relforcerowsecurity");
  });

  it('captures exact merchant grant vectors and PGMQ exposure', async () => {
    const sql = await readSql();

    expect(sql).toContain("'grant-vector'");
    expect(sql).toContain("'public','merchants'");
    expect(sql).toContain("'public','merchant_feature_settings'");
    expect(sql).toContain("'PUBLIC'");
    expect(sql).toContain("'anon'");
    expect(sql).toContain("'authenticated'");
    expect(sql).toContain("'service_role'");
    expect(sql).toContain("acldefault('f',p.proowner)");
    expect(sql).toContain("acldefault('n',n.nspowner)");
    expect(sql).toContain("acldefault('r',c.relowner)");
    expect(sql).toContain('has_schema_privilege');
    expect(sql).toContain('has_table_privilege');
    expect(sql).toContain('has_function_privilege');
    expect(sql).toContain("'pgmq_public'");
    expect(sql).toContain("'schema-presence'");
    expect(sql).toContain("'pgmq-access'");
    const queue = sql.slice(
      sql.indexOf('pgmq_queue_components AS'),
      sql.indexOf('pgmq_access_components AS')
    );
    for (const field of [
      "'identity',a.attidentity::text",
      "'generated',a.attgenerated::text",
      "'type',x.contype::text",
      "'validated',x.convalidated",
      "'deferrable',x.condeferrable",
      "'deferred',x.condeferred",
      "'valid',ix.indisvalid",
      "'ready',ix.indisready",
      "'live',ix.indislive",
    ]) {
      expect(queue).toContain(field);
    }
    expect(sql.match(/SELECT DISTINCT/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps only required extensions structurally and excludes unrelated projections', async () => {
    const sql = await readSql();

    expect(sql).toContain("('pgcrypto','extensions')");
    expect(sql).toContain("('pgmq','pgmq')");
    for (const excluded of [
      "'cron-net'",
      "'storage-policies'",
      "'uuid-ossp'",
      "'pg_net'",
      "'pg_cron'",
      "'postgis'",
      "'vector'",
    ]) {
      expect(sql).not.toContain(excluded);
    }
    expect(sql).not.toMatch(/\bFROM\s+storage[.]/i);
    expect(sql).not.toMatch(/\bFROM\s+cron[.]/i);
  });
});
