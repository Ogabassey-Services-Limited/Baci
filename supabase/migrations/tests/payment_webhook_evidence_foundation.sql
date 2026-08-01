-- Contract test for the sealed dormant payment-webhook evidence foundation.
-- Run this after the migration in a disposable replay database. Before the
-- migration exists, the first statement is intentionally the RED-A failure.

BEGIN;

SELECT count(*)
FROM private.payment_webhook_inbox;

DO $$
DECLARE
  v_relation text;
  v_role text;
  v_missing_column text;
  v_missing_constraint text;
  v_missing_index text;
BEGIN
  FOREACH v_relation IN ARRAY ARRAY[
    'payment_webhook_inbox',
    'payment_webhook_source_manifests',
    'payment_webhook_source_proofs'
  ] LOOP
    IF to_regclass('private.' || v_relation) IS NULL THEN
      RAISE EXCEPTION 'payment webhook evidence relation is missing: %', v_relation;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_class
      WHERE oid = ('private.' || v_relation)::regclass
        AND relrowsecurity
        AND relforcerowsecurity
    ) THEN
      RAISE EXCEPTION 'payment webhook evidence relation must enable and force RLS: %', v_relation;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_policy
      WHERE polrelid = ('private.' || v_relation)::regclass
    ) THEN
      RAISE EXCEPTION 'payment webhook evidence relation must have no policies: %', v_relation;
    END IF;

    IF (SELECT count(*) FROM pg_catalog.pg_class WHERE oid = ('private.' || v_relation)::regclass) <> 1 THEN
      RAISE EXCEPTION 'payment webhook evidence relation catalog lookup failed: %', v_relation;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_class relation
      CROSS JOIN LATERAL aclexplode(COALESCE(relation.relacl, acldefault('r', relation.relowner))) privilege
      WHERE relation.oid = ('private.' || v_relation)::regclass
        AND privilege.grantee = 0
    ) THEN
      RAISE EXCEPTION 'payment webhook evidence relation must deny PUBLIC: %', v_relation;
    END IF;

    FOREACH v_role IN ARRAY ARRAY[
      'anon', 'authenticated', 'service_role', 'payment_control_plane'
    ] LOOP
      IF has_table_privilege(v_role, ('private.' || v_relation)::regclass,
        'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') THEN
        RAISE EXCEPTION 'payment webhook evidence relation must deny % on %', v_role, v_relation;
      END IF;
    END LOOP;

    IF (SELECT count(*) FROM pg_catalog.pg_class WHERE oid = ('private.' || v_relation)::regclass) = 1
      AND (SELECT count(*) FROM pg_catalog.pg_stat_user_tables WHERE relid = ('private.' || v_relation)::regclass) = 0 THEN
      NULL;
    END IF;
  END LOOP;

  SELECT expected.column_name
  INTO v_missing_column
  FROM (
    VALUES
      ('id'), ('provider'), ('endpoint_key'), ('signature_key_scope'),
      ('completion_authority_key'), ('signature_key_identity_id'),
      ('ingress_contract_generation_id'), ('ingress_contract_generation'),
      ('adapter_schema_version'), ('normalized_envelope_schema_version'),
      ('replay_identity_contract_version'), ('replay_key_kind'),
      ('replay_key_digest'), ('replay_key_preimage'), ('ingress_scope_snapshot'),
      ('normalized_envelope'), ('normalized_envelope_sha256'), ('raw_body_sha256'),
      ('event_type'), ('provider_reference'), ('amount_minor'), ('currency'),
      ('provider_paid_at'), ('provider_received_at'), ('verified_at'), ('merchant_id'),
      ('provider_account_scope'), ('source_manifest_id'), ('capture_mode'),
      ('child_manifest_sha256'), ('child_count'), ('manifest_amount_minor'),
      ('manifest_currency'), ('processing_status'), ('processing_attempt_count'),
      ('last_error'), ('processed_at'), ('claim_installed_child_count'),
      ('no_safe_order_claim_child_count'), ('late_ingress_child_count'),
      ('not_order_protecting_child_count'), ('intake_protection_complete'),
      ('received_at'), ('created_at'), ('updated_at')
  ) AS expected(column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'private'
      AND table_name = 'payment_webhook_inbox'
      AND column_name = expected.column_name
  )
  LIMIT 1;

  IF v_missing_column IS NOT NULL OR (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'private' AND table_name = 'payment_webhook_inbox'
  ) <> 45 THEN
    RAISE EXCEPTION 'payment webhook inbox columns do not match the frozen contract: %', v_missing_column;
  END IF;

  SELECT expected.column_name
  INTO v_missing_column
  FROM (
    VALUES
      ('id'), ('inbox_id'), ('provider'), ('endpoint_key'), ('signature_key_scope'),
      ('completion_authority_key'), ('signature_key_identity_id'),
      ('ingress_contract_generation_id'), ('ingress_contract_generation'),
      ('adapter_schema_version'), ('normalized_envelope_schema_version'),
      ('replay_identity_contract_version'), ('replay_key_kind'), ('replay_key_digest'),
      ('replay_key_preimage'), ('ingress_scope_snapshot'), ('merchant_id'),
      ('provider_account_scope'), ('capture_mode'), ('child_manifest_sha256'),
      ('child_count'), ('amount_minor'), ('currency'), ('contract_bound_minor'),
      ('redacted_parent_source_identity'), ('created_at')
  ) AS expected(column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'private'
      AND table_name = 'payment_webhook_source_manifests'
      AND column_name = expected.column_name
  )
  LIMIT 1;

  IF v_missing_column IS NOT NULL OR (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'private' AND table_name = 'payment_webhook_source_manifests'
  ) <> 26 THEN
    RAISE EXCEPTION 'payment webhook source manifest columns do not match the frozen contract: %', v_missing_column;
  END IF;

  SELECT expected.column_name
  INTO v_missing_column
  FROM (
    VALUES
      ('id'), ('source_manifest_id'), ('child_identity'), ('child_ordinal'),
      ('child_reference'), ('capture_identity'), ('amount_minor'), ('currency'),
      ('provider_paid_at'), ('paid_time_precision'), ('child_sha256'),
      ('intake_decision'), ('decided_at'), ('decision_reason_code'),
      ('review_scope_kind'), ('review_id'), ('created_at')
  ) AS expected(column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'private'
      AND table_name = 'payment_webhook_source_proofs'
      AND column_name = expected.column_name
  )
  LIMIT 1;

  IF v_missing_column IS NOT NULL OR (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'private' AND table_name = 'payment_webhook_source_proofs'
  ) <> 17 THEN
    RAISE EXCEPTION 'payment webhook source proof columns do not match the frozen contract: %', v_missing_column;
  END IF;

  -- `information_schema` above confirms the public names; this catalog-level
  -- matrix seals physical order, rendered type names, and nullability as well.
  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        (
          'payment_webhook_inbox',
          ARRAY['id','provider','endpoint_key','signature_key_scope','completion_authority_key','signature_key_identity_id','ingress_contract_generation_id','ingress_contract_generation','adapter_schema_version','normalized_envelope_schema_version','replay_identity_contract_version','replay_key_kind','replay_key_digest','replay_key_preimage','ingress_scope_snapshot','normalized_envelope','normalized_envelope_sha256','raw_body_sha256','event_type','provider_reference','amount_minor','currency','provider_paid_at','provider_received_at','verified_at','merchant_id','provider_account_scope','source_manifest_id','capture_mode','child_manifest_sha256','child_count','manifest_amount_minor','manifest_currency','processing_status','processing_attempt_count','last_error','processed_at','claim_installed_child_count','no_safe_order_claim_child_count','late_ingress_child_count','not_order_protecting_child_count','intake_protection_complete','received_at','created_at','updated_at']::text[],
          ARRAY['uuid','text','text','text','text','uuid','uuid','bigint','text','text','text','text','text','jsonb','jsonb','jsonb','text','text','text','text','bigint','text','timestamp with time zone','timestamp with time zone','timestamp with time zone','uuid','text','uuid','text','text','integer','bigint','text','text','integer','text','timestamp with time zone','integer','integer','integer','integer','boolean','timestamp with time zone','timestamp with time zone','timestamp with time zone']::text[],
          ARRAY[true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,false,false,false,false,false,true,false,false,true,true,true,true,true,true,true,true,false,false,true,true,true,true,true,true,true,true]::boolean[]
        ),
        (
          'payment_webhook_source_manifests',
          ARRAY['id','inbox_id','provider','endpoint_key','signature_key_scope','completion_authority_key','signature_key_identity_id','ingress_contract_generation_id','ingress_contract_generation','adapter_schema_version','normalized_envelope_schema_version','replay_identity_contract_version','replay_key_kind','replay_key_digest','replay_key_preimage','ingress_scope_snapshot','merchant_id','provider_account_scope','capture_mode','child_manifest_sha256','child_count','amount_minor','currency','contract_bound_minor','redacted_parent_source_identity','created_at']::text[],
          ARRAY['uuid','uuid','text','text','text','text','uuid','uuid','bigint','text','text','text','text','text','jsonb','jsonb','uuid','text','text','text','integer','bigint','text','bigint','jsonb','timestamp with time zone']::text[],
          ARRAY[true,false,true,true,true,true,true,true,true,true,true,true,true,true,true,true,false,false,true,true,true,true,true,true,true,true]::boolean[]
        ),
        (
          'payment_webhook_source_proofs',
          ARRAY['id','source_manifest_id','child_identity','child_ordinal','child_reference','capture_identity','amount_minor','currency','provider_paid_at','paid_time_precision','child_sha256','intake_decision','decided_at','decision_reason_code','review_scope_kind','review_id','created_at']::text[],
          ARRAY['uuid','uuid','text','integer','text','text','bigint','text','timestamp with time zone','text','text','text','timestamp with time zone','text','text','uuid','timestamp with time zone']::text[],
          ARRAY[true,true,true,true,false,true,true,true,false,true,true,true,true,true,true,false,true]::boolean[]
        )
    ) AS expected(table_name, column_names, type_names, not_null)
    LEFT JOIN pg_class relation ON relation.relname = expected.table_name
    LEFT JOIN pg_namespace schema ON schema.oid = relation.relnamespace
    LEFT JOIN LATERAL (
      SELECT
        array_agg(attribute.attname::text ORDER BY attribute.attnum) AS column_names,
        array_agg(format_type(attribute.atttypid, attribute.atttypmod) ORDER BY attribute.attnum) AS type_names,
        array_agg(attribute.attnotnull ORDER BY attribute.attnum) AS not_null
      FROM pg_attribute attribute
      WHERE attribute.attrelid = relation.oid
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
    ) AS actual ON true
    WHERE schema.nspname IS DISTINCT FROM 'private'
      OR actual.column_names IS DISTINCT FROM expected.column_names
      OR actual.type_names IS DISTINCT FROM expected.type_names
      OR actual.not_null IS DISTINCT FROM expected.not_null
  ) THEN
    RAISE EXCEPTION 'payment webhook evidence columns do not match the ordered relation-scoped catalog contract';
  END IF;

  SELECT expected.name INTO v_missing_constraint
  FROM (
    VALUES
      ('payment_ingress_contract_generations_evidence_binding_key'),
      ('payment_webhook_inbox_provider_check'), ('payment_webhook_inbox_endpoint_key_check'),
      ('payment_webhook_inbox_signature_scope_check'), ('payment_webhook_inbox_authority_key_check'),
      ('payment_webhook_inbox_generation_fkey'), ('payment_webhook_inbox_replay_kind_check'),
      ('payment_webhook_inbox_replay_digest_check'), ('payment_webhook_inbox_replay_preimage_check'),
      ('payment_webhook_inbox_ingress_scope_snapshot_check'), ('payment_webhook_inbox_envelope_check'),
      ('payment_webhook_inbox_hashes_check'), ('payment_webhook_inbox_event_type_check'),
      ('payment_webhook_inbox_reference_check'), ('payment_webhook_inbox_amount_currency_check'),
      ('payment_webhook_inbox_manifest_check'), ('payment_webhook_inbox_processing_check'),
      ('payment_webhook_inbox_error_check'), ('payment_webhook_inbox_decision_projection_check'),
      ('payment_webhook_inbox_source_manifest_fkey'),
      ('payment_webhook_source_manifests_provider_check'), ('payment_webhook_source_manifests_endpoint_key_check'),
      ('payment_webhook_source_manifests_signature_scope_check'), ('payment_webhook_source_manifests_authority_key_check'),
      ('payment_webhook_source_manifests_generation_fkey'), ('payment_webhook_source_manifests_replay_kind_check'),
      ('payment_webhook_source_manifests_replay_digest_check'), ('payment_webhook_source_manifests_replay_preimage_check'),
      ('payment_webhook_source_manifests_scope_snapshot_check'), ('payment_webhook_source_manifests_economics_check'),
      ('payment_webhook_source_manifests_parent_identity_check'), ('payment_webhook_source_manifests_inbox_fkey'),
      ('payment_webhook_source_proofs_manifest_fkey'), ('payment_webhook_source_proofs_child_identity_check'),
      ('payment_webhook_source_proofs_ordinal_check'), ('payment_webhook_source_proofs_reference_check'),
      ('payment_webhook_source_proofs_capture_identity_check'), ('payment_webhook_source_proofs_amount_check'),
      ('payment_webhook_source_proofs_currency_fkey'), ('payment_webhook_source_proofs_paid_precision_check'),
      ('payment_webhook_source_proofs_hash_check'), ('payment_webhook_source_proofs_decision_check'),
      ('payment_webhook_source_proofs_reason_check'), ('payment_webhook_source_proofs_review_scope_check'),
      ('payment_webhook_source_proofs_decision_shape_check')
  ) AS expected(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = expected.name
      AND (
        (expected.name = 'payment_ingress_contract_generations_evidence_binding_key'
          AND conrelid = 'private.payment_ingress_contract_generations'::regclass)
        OR (expected.name LIKE 'payment_webhook_inbox_%'
          AND conrelid = 'private.payment_webhook_inbox'::regclass)
        OR (expected.name LIKE 'payment_webhook_source_manifests_%'
          AND conrelid = 'private.payment_webhook_source_manifests'::regclass)
        OR (expected.name LIKE 'payment_webhook_source_proofs_%'
          AND conrelid = 'private.payment_webhook_source_proofs'::regclass)
      )
  )
  LIMIT 1;

  IF v_missing_constraint IS NOT NULL THEN
    RAISE EXCEPTION 'payment webhook evidence constraint is missing: %', v_missing_constraint;
  END IF;

  SELECT expected.name INTO v_missing_index
  FROM (
    VALUES
      ('payment_webhook_inbox_replay_key_uq'), ('payment_webhook_inbox_manifest_binding_uq'),
      ('payment_webhook_inbox_pkey'),
      ('payment_webhook_inbox_processing_idx'), ('payment_webhook_source_manifests_replay_key_uq'),
      ('payment_webhook_source_manifests_pkey'),
      ('payment_webhook_source_manifests_inbox_target_uq'), ('payment_webhook_source_manifests_binding_uq'),
      ('payment_webhook_source_manifests_currency_target_uq'),
      ('payment_webhook_source_manifests_provider_account_idx'),
      ('payment_webhook_source_manifests_generation_idx'),
      ('payment_webhook_source_proofs_manifest_child_uq'),
      ('payment_webhook_source_proofs_pkey'),
      ('payment_webhook_source_proofs_manifest_ordinal_uq'),
      ('payment_webhook_source_proofs_manifest_capture_uq'),
      ('payment_webhook_source_proofs_decision_idx'),
      ('payment_webhook_inbox_generation_idx'),
      ('payment_webhook_inbox_source_manifest_idx'),
      ('payment_webhook_source_manifests_inbox_idx')
  ) AS expected(name)
  WHERE NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = expected.name)
  LIMIT 1;

  IF v_missing_index IS NOT NULL THEN
    RAISE EXCEPTION 'payment webhook evidence index is missing: %', v_missing_index;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('payment_webhook_inbox_pkey', 'payment_webhook_inbox', ARRAY['id']::text[], true, true, NULL::text),
        ('payment_webhook_inbox_replay_key_uq', 'payment_webhook_inbox', ARRAY['replay_key_kind', 'replay_key_digest']::text[], true, false, NULL::text),
        ('payment_webhook_inbox_manifest_binding_uq', 'payment_webhook_inbox', ARRAY['id', 'source_manifest_id', 'replay_key_kind', 'replay_key_digest', 'provider', 'endpoint_key', 'signature_key_scope', 'completion_authority_key', 'signature_key_identity_id', 'ingress_contract_generation', 'adapter_schema_version', 'normalized_envelope_schema_version', 'replay_identity_contract_version']::text[], true, false, NULL::text),
        ('payment_webhook_inbox_processing_idx', 'payment_webhook_inbox', ARRAY['processing_status', 'received_at', 'id']::text[], false, false, NULL::text),
        ('payment_webhook_inbox_generation_idx', 'payment_webhook_inbox', ARRAY['ingress_contract_generation_id', 'id']::text[], false, false, NULL::text),
        ('payment_webhook_inbox_source_manifest_idx', 'payment_webhook_inbox', ARRAY['source_manifest_id', 'id']::text[], false, false, NULL::text),
        ('payment_webhook_source_manifests_pkey', 'payment_webhook_source_manifests', ARRAY['id']::text[], true, true, NULL::text),
        ('payment_webhook_source_manifests_replay_key_uq', 'payment_webhook_source_manifests', ARRAY['replay_key_kind', 'replay_key_digest']::text[], true, false, NULL::text),
        ('payment_webhook_source_manifests_inbox_target_uq', 'payment_webhook_source_manifests', ARRAY['id', 'replay_key_kind', 'replay_key_digest', 'provider', 'endpoint_key', 'signature_key_scope', 'completion_authority_key', 'signature_key_identity_id', 'ingress_contract_generation', 'adapter_schema_version', 'normalized_envelope_schema_version', 'replay_identity_contract_version']::text[], true, false, NULL::text),
        ('payment_webhook_source_manifests_binding_uq', 'payment_webhook_source_manifests', ARRAY['id', 'replay_key_kind', 'replay_key_digest', 'provider', 'endpoint_key', 'signature_key_scope', 'completion_authority_key', 'signature_key_identity_id', 'ingress_contract_generation', 'adapter_schema_version', 'normalized_envelope_schema_version', 'replay_identity_contract_version', 'currency']::text[], true, false, NULL::text),
        ('payment_webhook_source_manifests_currency_target_uq', 'payment_webhook_source_manifests', ARRAY['id', 'currency']::text[], true, false, NULL::text),
        ('payment_webhook_source_manifests_provider_account_idx', 'payment_webhook_source_manifests', ARRAY['provider', 'provider_account_scope', 'created_at', 'id']::text[], false, false, NULL::text),
        ('payment_webhook_source_manifests_generation_idx', 'payment_webhook_source_manifests', ARRAY['ingress_contract_generation_id', 'id']::text[], false, false, NULL::text),
        ('payment_webhook_source_manifests_inbox_idx', 'payment_webhook_source_manifests', ARRAY['inbox_id', 'id']::text[], false, false, '(inbox_id IS NOT NULL)'::text),
        ('payment_webhook_source_proofs_pkey', 'payment_webhook_source_proofs', ARRAY['id']::text[], true, true, NULL::text),
        ('payment_webhook_source_proofs_manifest_child_uq', 'payment_webhook_source_proofs', ARRAY['source_manifest_id', 'child_identity']::text[], true, false, NULL::text),
        ('payment_webhook_source_proofs_manifest_ordinal_uq', 'payment_webhook_source_proofs', ARRAY['source_manifest_id', 'child_ordinal']::text[], true, false, NULL::text),
        ('payment_webhook_source_proofs_manifest_capture_uq', 'payment_webhook_source_proofs', ARRAY['source_manifest_id', 'capture_identity']::text[], true, false, NULL::text),
        ('payment_webhook_source_proofs_decision_idx', 'payment_webhook_source_proofs', ARRAY['intake_decision', 'review_scope_kind', 'decided_at', 'id']::text[], false, false, NULL::text)
    ) AS expected(index_name, table_name, key_columns, is_unique, is_primary, predicate)
    LEFT JOIN pg_namespace index_namespace
      ON index_namespace.nspname = 'private'
    LEFT JOIN pg_class index_relation
      ON index_relation.relnamespace = index_namespace.oid
      AND index_relation.relname = expected.index_name
    LEFT JOIN pg_index index_catalog
      ON index_catalog.indexrelid = index_relation.oid
    LEFT JOIN pg_class table_relation
      ON table_relation.oid = index_catalog.indrelid
    LEFT JOIN pg_namespace table_namespace
      ON table_namespace.oid = table_relation.relnamespace
    LEFT JOIN LATERAL (
      SELECT array_agg(attribute.attname::text ORDER BY key_columns.ordinality) AS names
      FROM unnest(index_catalog.indkey) WITH ORDINALITY AS key_columns(attnum, ordinality)
      JOIN pg_attribute attribute
        ON attribute.attrelid = table_relation.oid
        AND attribute.attnum = key_columns.attnum
    ) AS actual_keys ON true
    WHERE index_relation.oid IS NULL
      OR table_namespace.nspname IS DISTINCT FROM 'private'
      OR table_relation.relname IS DISTINCT FROM expected.table_name
      OR index_catalog.indisunique IS DISTINCT FROM expected.is_unique
      OR index_catalog.indisprimary IS DISTINCT FROM expected.is_primary
      OR actual_keys.names IS DISTINCT FROM expected.key_columns
      OR COALESCE(pg_get_expr(index_catalog.indpred, index_catalog.indrelid), NULL) IS DISTINCT FROM expected.predicate
  ) THEN
    RAISE EXCEPTION 'payment webhook evidence index metadata does not match the sealed schema-and-relation-scoped contract';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('payment_webhook_inbox', 'payment_webhook_inbox_pkey', 'PRIMARY KEY (id)'),
        ('payment_webhook_source_manifests', 'payment_webhook_source_manifests_pkey', 'PRIMARY KEY (id)'),
        ('payment_webhook_source_proofs', 'payment_webhook_source_proofs_pkey', 'PRIMARY KEY (id)')
    ) AS expected(table_name, constraint_name, definition)
    LEFT JOIN pg_constraint constraint_catalog
      ON constraint_catalog.conrelid = ('private.' || expected.table_name)::regclass
      AND constraint_catalog.conname = expected.constraint_name
    WHERE constraint_catalog.contype IS DISTINCT FROM 'p'
      OR regexp_replace(pg_get_constraintdef(constraint_catalog.oid), '\s+', ' ', 'g') IS DISTINCT FROM expected.definition
  ) THEN
    RAISE EXCEPTION 'payment webhook evidence primary-key constraints do not match the relation-scoped contract';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('payment_webhook_inbox', 'id', 'gen_random_uuid()'),
        ('payment_webhook_inbox', 'processing_status', '''received''::text'),
        ('payment_webhook_inbox', 'processing_attempt_count', '0'),
        ('payment_webhook_inbox', 'claim_installed_child_count', '0'),
        ('payment_webhook_inbox', 'no_safe_order_claim_child_count', '0'),
        ('payment_webhook_inbox', 'late_ingress_child_count', '0'),
        ('payment_webhook_inbox', 'not_order_protecting_child_count', '0'),
        ('payment_webhook_inbox', 'intake_protection_complete', 'false'),
        ('payment_webhook_inbox', 'received_at', 'now()'),
        ('payment_webhook_inbox', 'created_at', 'now()'),
        ('payment_webhook_inbox', 'updated_at', 'now()'),
        ('payment_webhook_source_manifests', 'id', 'gen_random_uuid()'),
        ('payment_webhook_source_manifests', 'created_at', 'now()'),
        ('payment_webhook_source_proofs', 'id', 'gen_random_uuid()'),
        ('payment_webhook_source_proofs', 'created_at', 'now()')
    ) AS expected(table_name, column_name, default_expression)
    LEFT JOIN pg_class relation ON relation.relname = expected.table_name
    LEFT JOIN pg_namespace schema ON schema.oid = relation.relnamespace
    LEFT JOIN pg_attribute attribute
      ON attribute.attrelid = relation.oid
      AND attribute.attname = expected.column_name
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
    LEFT JOIN pg_attrdef default_value
      ON default_value.adrelid = relation.oid
      AND default_value.adnum = attribute.attnum
    WHERE schema.nspname IS DISTINCT FROM 'private'
      OR pg_get_expr(default_value.adbin, default_value.adrelid) IS DISTINCT FROM expected.default_expression
  ) OR EXISTS (
    SELECT 1
    FROM pg_attrdef default_value
    JOIN pg_class relation ON relation.oid = default_value.adrelid
    JOIN pg_namespace schema ON schema.oid = relation.relnamespace
    JOIN pg_attribute attribute
      ON attribute.attrelid = relation.oid AND attribute.attnum = default_value.adnum
    WHERE schema.nspname = 'private'
      AND relation.relname IN ('payment_webhook_inbox', 'payment_webhook_source_manifests', 'payment_webhook_source_proofs')
      AND (relation.relname, attribute.attname) NOT IN (
        ('payment_webhook_inbox', 'id'), ('payment_webhook_inbox', 'processing_status'),
        ('payment_webhook_inbox', 'processing_attempt_count'), ('payment_webhook_inbox', 'claim_installed_child_count'),
        ('payment_webhook_inbox', 'no_safe_order_claim_child_count'), ('payment_webhook_inbox', 'late_ingress_child_count'),
        ('payment_webhook_inbox', 'not_order_protecting_child_count'), ('payment_webhook_inbox', 'intake_protection_complete'),
        ('payment_webhook_inbox', 'received_at'), ('payment_webhook_inbox', 'created_at'), ('payment_webhook_inbox', 'updated_at'),
        ('payment_webhook_source_manifests', 'id'), ('payment_webhook_source_manifests', 'created_at'),
        ('payment_webhook_source_proofs', 'id'), ('payment_webhook_source_proofs', 'created_at')
      )
  ) THEN
    RAISE EXCEPTION 'payment webhook evidence defaults do not match the relation-scoped contract';
  END IF;
END;
$$;

DO $$
DECLARE
  v_generation_id uuid := '10000000-0000-4000-8000-000000000001';
  v_identity_id uuid := '10000000-0000-4000-8000-000000000002';
  v_manifest_id uuid := '20000000-0000-4000-8000-000000000001';
  v_inbox_id uuid := '30000000-0000-4000-8000-000000000001';
  v_proof_id uuid := '40000000-0000-4000-8000-000000000001';
  v_constraint text;
  v_table text;
  v_expected_constraint text;
  v_kind text;
  v_preimage jsonb;
  v_keys text[];
  v_key text;
  v_scope jsonb := '{"merchant_id":"__unresolved__","provider_account_scope":"__unresolved__"}'::jsonb;
  v_envelope jsonb := '{"contract_version":"envelope-v1","event_type":"payment.received","receiver":{},"provider_customer":null,"assignment":{},"economics":{},"paid_time":null,"children":[]}'::jsonb;
  v_parent jsonb := '{"event_type":"payment.received","provider_reference":null}'::jsonb;
BEGIN
  IF (SELECT count(*) FROM private.payment_webhook_inbox) <> 0
    OR (SELECT count(*) FROM private.payment_webhook_source_manifests) <> 0
    OR (SELECT count(*) FROM private.payment_webhook_source_proofs) <> 0 THEN
    RAISE EXCEPTION 'payment webhook evidence relations must begin empty';
  END IF;

  IF obj_description('private.payment_webhook_inbox'::regclass, 'pg_class') IS DISTINCT FROM
    'Operational webhook replay infrastructure, never completion or financial authority; raw bodies, signatures, credentials, secrets, card data, and full customer addresses are forbidden.'
    OR obj_description('private.payment_webhook_source_manifests'::regclass, 'pg_class') IS DISTINCT FROM
      'Financial-retention ingress evidence independent of the prunable inbox, never completion authority.'
    OR obj_description('private.payment_webhook_source_proofs'::regclass, 'pg_class') IS DISTINCT FROM
      'Immutable child ingress evidence and terminal intake-protection decision, never a financial routing, attempt, transaction, allocation, or completion authority.'
  THEN
    RAISE EXCEPTION 'payment webhook evidence comments do not match the sealed contract';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('payment_webhook_source_manifests', 'payment_webhook_source_manifests_generation_fkey', 'FOREIGN KEY (ingress_contract_generation_id, provider, endpoint_key, signature_key_scope, completion_authority_key, signature_key_identity_id, ingress_contract_generation, adapter_schema_version, normalized_envelope_schema_version, replay_identity_contract_version) REFERENCES private.payment_ingress_contract_generations(id, provider, endpoint_key, signature_key_scope, authority_key, signature_key_identity_id, generation, parser_contract_version, normalized_envelope_schema_version, replay_identity_contract_version) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED'),
        ('payment_webhook_inbox', 'payment_webhook_inbox_generation_fkey', 'FOREIGN KEY (ingress_contract_generation_id, provider, endpoint_key, signature_key_scope, completion_authority_key, signature_key_identity_id, ingress_contract_generation, adapter_schema_version, normalized_envelope_schema_version, replay_identity_contract_version) REFERENCES private.payment_ingress_contract_generations(id, provider, endpoint_key, signature_key_scope, authority_key, signature_key_identity_id, generation, parser_contract_version, normalized_envelope_schema_version, replay_identity_contract_version) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED'),
        ('payment_webhook_inbox', 'payment_webhook_inbox_source_manifest_fkey', 'FOREIGN KEY (source_manifest_id, replay_key_kind, replay_key_digest, provider, endpoint_key, signature_key_scope, completion_authority_key, signature_key_identity_id, ingress_contract_generation, adapter_schema_version, normalized_envelope_schema_version, replay_identity_contract_version) REFERENCES private.payment_webhook_source_manifests(id, replay_key_kind, replay_key_digest, provider, endpoint_key, signature_key_scope, completion_authority_key, signature_key_identity_id, ingress_contract_generation, adapter_schema_version, normalized_envelope_schema_version, replay_identity_contract_version) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED'),
        ('payment_webhook_source_manifests', 'payment_webhook_source_manifests_inbox_fkey', 'FOREIGN KEY (inbox_id, id, replay_key_kind, replay_key_digest, provider, endpoint_key, signature_key_scope, completion_authority_key, signature_key_identity_id, ingress_contract_generation, adapter_schema_version, normalized_envelope_schema_version, replay_identity_contract_version) REFERENCES private.payment_webhook_inbox(id, source_manifest_id, replay_key_kind, replay_key_digest, provider, endpoint_key, signature_key_scope, completion_authority_key, signature_key_identity_id, ingress_contract_generation, adapter_schema_version, normalized_envelope_schema_version, replay_identity_contract_version) ON DELETE SET NULL (inbox_id) DEFERRABLE INITIALLY DEFERRED'),
        ('payment_webhook_source_proofs', 'payment_webhook_source_proofs_manifest_fkey', 'FOREIGN KEY (source_manifest_id) REFERENCES private.payment_webhook_source_manifests(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED'),
        ('payment_webhook_source_proofs', 'payment_webhook_source_proofs_currency_fkey', 'FOREIGN KEY (source_manifest_id, currency) REFERENCES private.payment_webhook_source_manifests(id, currency) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED')
    ) AS expected(table_name, constraint_name, definition)
    LEFT JOIN pg_constraint constraint_catalog
      ON constraint_catalog.conrelid = ('private.' || expected.table_name)::regclass
      AND constraint_catalog.conname = expected.constraint_name
      AND constraint_catalog.contype = 'f'
    WHERE NOT constraint_catalog.condeferrable
      OR NOT constraint_catalog.condeferred
      OR regexp_replace(pg_get_constraintdef(constraint_catalog.oid), '\s+', ' ', 'g') IS DISTINCT FROM expected.definition
  ) THEN
    RAISE EXCEPTION 'payment webhook evidence foreign keys do not match the normalized relation-scoped deferred retention contract';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('payment_ingress_contract_generations', 'payment_ingress_contract_generations_evidence_binding_key', 'UNIQUE (id, provider, endpoint_key, signature_key_scope, authority_key, signature_key_identity_id, generation, parser_contract_version, normalized_envelope_schema_version, replay_identity_contract_version)'),
        ('payment_webhook_inbox', 'payment_webhook_inbox_replay_key_uq', 'UNIQUE (replay_key_kind, replay_key_digest)'),
        ('payment_webhook_inbox', 'payment_webhook_inbox_manifest_binding_uq', 'UNIQUE (id, source_manifest_id, replay_key_kind, replay_key_digest, provider, endpoint_key, signature_key_scope, completion_authority_key, signature_key_identity_id, ingress_contract_generation, adapter_schema_version, normalized_envelope_schema_version, replay_identity_contract_version)'),
        ('payment_webhook_source_manifests', 'payment_webhook_source_manifests_replay_key_uq', 'UNIQUE (replay_key_kind, replay_key_digest)'),
        ('payment_webhook_source_manifests', 'payment_webhook_source_manifests_inbox_target_uq', 'UNIQUE (id, replay_key_kind, replay_key_digest, provider, endpoint_key, signature_key_scope, completion_authority_key, signature_key_identity_id, ingress_contract_generation, adapter_schema_version, normalized_envelope_schema_version, replay_identity_contract_version)'),
        ('payment_webhook_source_manifests', 'payment_webhook_source_manifests_binding_uq', 'UNIQUE (id, replay_key_kind, replay_key_digest, provider, endpoint_key, signature_key_scope, completion_authority_key, signature_key_identity_id, ingress_contract_generation, adapter_schema_version, normalized_envelope_schema_version, replay_identity_contract_version, currency)'),
        ('payment_webhook_source_manifests', 'payment_webhook_source_manifests_currency_target_uq', 'UNIQUE (id, currency)'),
        ('payment_webhook_source_proofs', 'payment_webhook_source_proofs_manifest_child_uq', 'UNIQUE (source_manifest_id, child_identity)'),
        ('payment_webhook_source_proofs', 'payment_webhook_source_proofs_manifest_ordinal_uq', 'UNIQUE (source_manifest_id, child_ordinal)'),
        ('payment_webhook_source_proofs', 'payment_webhook_source_proofs_manifest_capture_uq', 'UNIQUE (source_manifest_id, capture_identity)'),
        ('payment_webhook_inbox', 'payment_webhook_inbox_amount_currency_check', 'CHECK ((((amount_minor IS NULL) AND (currency IS NULL)) OR ((amount_minor IS NOT NULL) AND (currency IS NOT NULL) AND (amount_minor > 0) AND (currency ~ ''^[A-Z]{3}$''::text))))'),
        ('payment_webhook_source_manifests', 'payment_webhook_source_manifests_economics_check', 'CHECK ((((provider_account_scope IS NULL) OR ((provider_account_scope = btrim(provider_account_scope)) AND (provider_account_scope <> ''''::text) AND (char_length(provider_account_scope) <= 255))) AND (adapter_schema_version = btrim(adapter_schema_version)) AND (adapter_schema_version <> ''''::text) AND (char_length(adapter_schema_version) <= 255) AND (normalized_envelope_schema_version = btrim(normalized_envelope_schema_version)) AND (normalized_envelope_schema_version <> ''''::text) AND (char_length(normalized_envelope_schema_version) <= 255) AND (replay_identity_contract_version = btrim(replay_identity_contract_version)) AND (replay_identity_contract_version <> ''''::text) AND (char_length(replay_identity_contract_version) <= 255) AND (capture_mode = ANY (ARRAY[''singleton''::text, ''bounded_multi_capture''::text])) AND (child_manifest_sha256 ~ ''^[0-9a-f]{64}$''::text) AND ((child_count >= 1) AND (child_count <= 64)) AND ((capture_mode <> ''singleton''::text) OR (child_count = 1)) AND (amount_minor > 0) AND (currency ~ ''^[A-Z]{3}$''::text) AND (contract_bound_minor > 0)))'),
        ('payment_webhook_source_proofs', 'payment_webhook_source_proofs_decision_shape_check', 'CHECK ((((intake_decision = ANY (ARRAY[''claim_installed''::text, ''not_order_protecting''::text])) AND (review_scope_kind = ''none''::text) AND (review_id IS NULL)) OR ((intake_decision = ANY (ARRAY[''no_safe_order_claim''::text, ''late_ingress''::text])) AND (review_scope_kind = ANY (ARRAY[''merchant_reconciliation''::text, ''global_quarantine''::text])) AND (review_id IS NOT NULL))))')
    ) AS expected(table_name, constraint_name, definition)
    LEFT JOIN pg_constraint constraint_catalog
      ON constraint_catalog.conrelid = ('private.' || expected.table_name)::regclass
      AND constraint_catalog.conname = expected.constraint_name
    WHERE regexp_replace(pg_get_constraintdef(constraint_catalog.oid), '\s+', ' ', 'g') IS DISTINCT FROM expected.definition
  ) THEN
    RAISE EXCEPTION 'payment webhook evidence critical CHECK or UNIQUE definition differs from the normalized relation-scoped contract';
  END IF;

  INSERT INTO private.payment_ingress_signature_key_identities (
    id, provider, endpoint_key, signature_key_scope, identity_revision,
    identity_kind, material_fingerprint, provenance_reference
  ) VALUES (
    v_identity_id, 'provider', 'endpoint', 'signature', 1,
    'shared_secret_config', repeat('0', 64), 'test-identity'
  );

  INSERT INTO private.payment_ingress_contract_generations (
    id, provider, endpoint_key, signature_key_scope, signature_key_identity_id,
    authority_key, generation, parser_contract_version, parser_artifact_sha256,
    normalized_envelope_schema_version, replay_identity_contract_version
  ) VALUES (
    v_generation_id, 'provider', 'endpoint', 'signature',
    v_identity_id, 'authority', 1, 'adapter-v1',
    repeat('a', 64), 'envelope-v1', 'replay-v1'
  );

  INSERT INTO private.payment_webhook_source_manifests (
    id, provider, endpoint_key, signature_key_scope, completion_authority_key,
    signature_key_identity_id, ingress_contract_generation_id,
    ingress_contract_generation, adapter_schema_version,
    normalized_envelope_schema_version, replay_identity_contract_version,
    replay_key_kind, replay_key_digest, replay_key_preimage,
    ingress_scope_snapshot, capture_mode, child_manifest_sha256, child_count,
    amount_minor, currency, contract_bound_minor, redacted_parent_source_identity
  ) VALUES (
    v_manifest_id, 'provider', 'endpoint', 'signature', 'authority',
    v_identity_id, v_generation_id, 1, 'adapter-v1',
    'envelope-v1', 'replay-v1', 'svix', repeat('b', 64),
    '{"v":1,"kind":"svix","provider":"provider","endpoint_key":"endpoint","signature_key_scope":"signature","completion_authority_key":"authority","svix_id":"event-1","event_type":"payment.received"}'::jsonb,
    v_scope, 'singleton', repeat('c', 64), 1, 100, 'NGN', 100, v_parent
  );

  INSERT INTO private.payment_webhook_inbox (
    id, provider, endpoint_key, signature_key_scope, completion_authority_key,
    signature_key_identity_id, ingress_contract_generation_id,
    ingress_contract_generation, adapter_schema_version,
    normalized_envelope_schema_version, replay_identity_contract_version,
    replay_key_kind, replay_key_digest, replay_key_preimage,
    ingress_scope_snapshot, normalized_envelope, normalized_envelope_sha256,
    raw_body_sha256, event_type, verified_at, source_manifest_id, capture_mode,
    child_manifest_sha256, child_count, manifest_amount_minor, manifest_currency
  ) VALUES (
    v_inbox_id, 'provider', 'endpoint', 'signature', 'authority',
    v_identity_id, v_generation_id, 1, 'adapter-v1',
    'envelope-v1', 'replay-v1', 'svix', repeat('b', 64),
    '{"v":1,"kind":"svix","provider":"provider","endpoint_key":"endpoint","signature_key_scope":"signature","completion_authority_key":"authority","svix_id":"event-1","event_type":"payment.received"}'::jsonb,
    v_scope, v_envelope, repeat('d', 64), repeat('e', 64), 'payment.received',
    '2026-08-01 12:00:00+00', v_manifest_id, 'singleton', repeat('c', 64), 1,
    100, 'NGN'
  );

  UPDATE private.payment_webhook_source_manifests
  SET inbox_id = v_inbox_id
  WHERE id = v_manifest_id;

  INSERT INTO private.payment_webhook_source_proofs (
    id, source_manifest_id, child_identity, child_ordinal, capture_identity,
    amount_minor, currency, paid_time_precision, child_sha256, intake_decision,
    decided_at, decision_reason_code, review_scope_kind
  ) VALUES (
    v_proof_id, v_manifest_id, 'singleton', 1, 'capture-1', 100, 'NGN',
    'exact', repeat('f', 64), 'claim_installed', '2026-08-01 12:00:00+00',
    'claim_installed', 'none'
  );

  SET CONSTRAINTS ALL IMMEDIATE;

  BEGIN
    UPDATE private.payment_webhook_inbox
    SET amount_minor = NULL, currency = 'NGN'
    WHERE id = v_inbox_id;
    RAISE EXCEPTION 'amount-null/currency-populated pair unexpectedly passed';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint IS DISTINCT FROM 'payment_webhook_inbox_amount_currency_check' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE private.payment_webhook_inbox
    SET amount_minor = 100, currency = NULL
    WHERE id = v_inbox_id;
    RAISE EXCEPTION 'amount-populated/currency-null pair unexpectedly passed';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint IS DISTINCT FROM 'payment_webhook_inbox_amount_currency_check' THEN RAISE; END IF;
  END;

  -- Valid account-reference and fallback-locator preimages are admitted without
  -- claiming that their digests or semantic facts are writer-validated here.
  INSERT INTO private.payment_webhook_source_manifests (
    id, provider, endpoint_key, signature_key_scope, completion_authority_key,
    signature_key_identity_id, ingress_contract_generation_id,
    ingress_contract_generation, adapter_schema_version,
    normalized_envelope_schema_version, replay_identity_contract_version,
    replay_key_kind, replay_key_digest, replay_key_preimage,
    ingress_scope_snapshot, capture_mode, child_manifest_sha256, child_count,
    amount_minor, currency, contract_bound_minor, redacted_parent_source_identity
  ) VALUES
    ('20000000-0000-4000-8000-000000000002', 'provider', 'endpoint', 'signature', 'authority',
      v_identity_id, v_generation_id, 1, 'adapter-v1', 'envelope-v1', 'replay-v1',
      'account_reference', repeat('1', 64),
      '{"v":1,"kind":"account_reference","provider":"provider","completion_authority_key":"authority","provider_account_scope":"__unresolved__","provider_reference":"reference-1","event_type":"payment.received"}'::jsonb,
      v_scope, 'singleton', repeat('2', 64), 1, 100, 'NGN', 100, '{}'::jsonb),
    ('20000000-0000-4000-8000-000000000003', 'provider', 'endpoint', 'signature', 'authority',
      v_identity_id, v_generation_id, 1, 'adapter-v1', 'envelope-v1', 'replay-v1',
      'fallback_locator', repeat('3', 64),
      '{"v":1,"kind":"fallback_locator","provider":"provider","endpoint_key":"endpoint","signature_key_scope":"signature","completion_authority_key":"authority","event_type":"payment.received","reference":"__unresolved__","amount_minor":"100","currency":"NGN","provider_paid_at":"__unresolved__","raw_body_sha256":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"}'::jsonb,
      v_scope, 'singleton', repeat('4', 64), 1, 100, 'NGN', 100, '{}'::jsonb);

  FOR v_table, v_expected_constraint IN
    SELECT * FROM (VALUES
      ('payment_webhook_inbox', 'payment_webhook_inbox_replay_preimage_check'),
      ('payment_webhook_source_manifests', 'payment_webhook_source_manifests_replay_preimage_check')
    ) AS targets(table_name, constraint_name)
  LOOP
    FOR v_kind, v_preimage, v_keys IN
      SELECT * FROM (VALUES
        ('svix',
          '{"v":1,"kind":"svix","provider":"provider","endpoint_key":"endpoint","signature_key_scope":"signature","completion_authority_key":"authority","svix_id":"event-1","event_type":"payment.received"}'::jsonb,
          ARRAY['v','kind','provider','endpoint_key','signature_key_scope','completion_authority_key','svix_id','event_type']::text[]),
        ('account_reference',
          '{"v":1,"kind":"account_reference","provider":"provider","completion_authority_key":"authority","provider_account_scope":"__unresolved__","provider_reference":"reference-1","event_type":"payment.received"}'::jsonb,
          ARRAY['v','kind','provider','completion_authority_key','provider_account_scope','provider_reference','event_type']::text[]),
        ('fallback_locator',
          '{"v":1,"kind":"fallback_locator","provider":"provider","endpoint_key":"endpoint","signature_key_scope":"signature","completion_authority_key":"authority","event_type":"payment.received","reference":"__unresolved__","amount_minor":"100","currency":"NGN","provider_paid_at":"__unresolved__","raw_body_sha256":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"}'::jsonb,
          ARRAY['v','kind','provider','endpoint_key','signature_key_scope','completion_authority_key','event_type','reference','amount_minor','currency','provider_paid_at','raw_body_sha256']::text[])
      ) AS tags(kind, preimage, keys)
    LOOP
      FOREACH v_key IN ARRAY v_keys LOOP
        BEGIN
          EXECUTE format('UPDATE private.%I SET replay_key_kind = $1, replay_key_preimage = $2 WHERE id = $3', v_table)
            USING v_kind, v_preimage - v_key,
              CASE WHEN v_table = 'payment_webhook_inbox' THEN v_inbox_id ELSE v_manifest_id END;
          RAISE EXCEPTION 'missing replay key unexpectedly passed: %.%', v_kind, v_key;
        EXCEPTION WHEN check_violation THEN
          GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
          IF v_constraint IS DISTINCT FROM v_expected_constraint THEN
            RAISE EXCEPTION 'missing replay key failed at %, expected %', v_constraint, v_expected_constraint;
          END IF;
        END;

        BEGIN
          EXECUTE format('UPDATE private.%I SET replay_key_kind = $1, replay_key_preimage = $2 WHERE id = $3', v_table)
            USING v_kind,
              jsonb_set(v_preimage, ARRAY[v_key], CASE WHEN v_key = 'v' THEN '"1"'::jsonb ELSE '1'::jsonb END, true),
              CASE WHEN v_table = 'payment_webhook_inbox' THEN v_inbox_id ELSE v_manifest_id END;
          RAISE EXCEPTION 'non-string replay key unexpectedly passed: %.%', v_kind, v_key;
        EXCEPTION WHEN check_violation THEN
          GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
          IF v_constraint IS DISTINCT FROM v_expected_constraint THEN
            RAISE EXCEPTION 'non-string replay key failed at %, expected %', v_constraint, v_expected_constraint;
          END IF;
        END;
      END LOOP;

      BEGIN
        EXECUTE format('UPDATE private.%I SET replay_key_kind = $1, replay_key_preimage = $2 WHERE id = $3', v_table)
          USING v_kind, jsonb_set(v_preimage, ARRAY['unknown_extension'], '"forbidden"'::jsonb, true),
            CASE WHEN v_table = 'payment_webhook_inbox' THEN v_inbox_id ELSE v_manifest_id END;
        RAISE EXCEPTION 'unknown replay extension unexpectedly passed: %', v_kind;
      EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint IS DISTINCT FROM v_expected_constraint THEN
          RAISE EXCEPTION 'unknown replay extension failed at %, expected %', v_constraint, v_expected_constraint;
        END IF;
      END;
    END LOOP;
  END LOOP;

  FOR v_table, v_expected_constraint IN
    SELECT * FROM (VALUES
      ('payment_webhook_inbox', 'payment_webhook_inbox_ingress_scope_snapshot_check'),
      ('payment_webhook_source_manifests', 'payment_webhook_source_manifests_scope_snapshot_check')
    ) AS targets(table_name, constraint_name)
  LOOP
    FOREACH v_key IN ARRAY ARRAY['merchant_id', 'provider_account_scope'] LOOP
      BEGIN
        EXECUTE format('UPDATE private.%I SET ingress_scope_snapshot = $1 WHERE id = $2', v_table)
          USING jsonb_set(v_scope, ARRAY[v_key], '1'::jsonb, true),
            CASE WHEN v_table = 'payment_webhook_inbox' THEN v_inbox_id ELSE v_manifest_id END;
        RAISE EXCEPTION 'non-string scope value unexpectedly passed: %', v_key;
      EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint IS DISTINCT FROM v_expected_constraint THEN
          RAISE EXCEPTION 'scope value failed at %, expected %', v_constraint, v_expected_constraint;
        END IF;
      END;
    END LOOP;
    BEGIN
      EXECUTE format('UPDATE private.%I SET ingress_scope_snapshot = $1 WHERE id = $2', v_table)
        USING v_scope - 'merchant_id', CASE WHEN v_table = 'payment_webhook_inbox' THEN v_inbox_id ELSE v_manifest_id END;
      RAISE EXCEPTION 'missing scope key unexpectedly passed';
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint IS DISTINCT FROM v_expected_constraint THEN RAISE; END IF;
    END;
    BEGIN
      EXECUTE format('UPDATE private.%I SET ingress_scope_snapshot = $1 WHERE id = $2', v_table)
        USING jsonb_set(v_scope, ARRAY['unknown_extension'], '"forbidden"'::jsonb, true),
          CASE WHEN v_table = 'payment_webhook_inbox' THEN v_inbox_id ELSE v_manifest_id END;
      RAISE EXCEPTION 'unknown scope extension unexpectedly passed';
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint IS DISTINCT FROM v_expected_constraint THEN RAISE; END IF;
    END;
  END LOOP;

  FOREACH v_key IN ARRAY ARRAY['contract_version', 'event_type', 'receiver', 'provider_customer', 'assignment', 'economics', 'paid_time', 'children'] LOOP
    BEGIN
      UPDATE private.payment_webhook_inbox
      SET normalized_envelope = v_envelope - v_key
      WHERE id = v_inbox_id;
      RAISE EXCEPTION 'missing envelope key unexpectedly passed: %', v_key;
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint IS DISTINCT FROM 'payment_webhook_inbox_envelope_check' THEN RAISE; END IF;
    END;
  END LOOP;

  FOREACH v_key IN ARRAY ARRAY['contract_version', 'event_type'] LOOP
    BEGIN
      UPDATE private.payment_webhook_inbox
      SET normalized_envelope = jsonb_set(v_envelope, ARRAY[v_key], '1'::jsonb, true)
      WHERE id = v_inbox_id;
      RAISE EXCEPTION 'non-string envelope scalar unexpectedly passed: %', v_key;
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint IS DISTINCT FROM 'payment_webhook_inbox_envelope_check' THEN RAISE; END IF;
    END;
  END LOOP;

  FOREACH v_key IN ARRAY ARRAY['receiver', 'provider_customer', 'assignment', 'economics', 'paid_time'] LOOP
    BEGIN
      UPDATE private.payment_webhook_inbox
      SET normalized_envelope = jsonb_set(v_envelope, ARRAY[v_key], '"not-an-object"'::jsonb, true)
      WHERE id = v_inbox_id;
      RAISE EXCEPTION 'non-object envelope evidence unexpectedly passed: %', v_key;
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint IS DISTINCT FROM 'payment_webhook_inbox_envelope_check' THEN RAISE; END IF;
    END;
  END LOOP;

  BEGIN
    UPDATE private.payment_webhook_inbox
    SET normalized_envelope = jsonb_set(v_envelope, ARRAY['children'], '{}'::jsonb, true)
    WHERE id = v_inbox_id;
    RAISE EXCEPTION 'non-array envelope children unexpectedly passed';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint IS DISTINCT FROM 'payment_webhook_inbox_envelope_check' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE private.payment_webhook_inbox
    SET normalized_envelope = jsonb_set(v_envelope, ARRAY['unknown_extension'], '"forbidden"'::jsonb, true)
    WHERE id = v_inbox_id;
    RAISE EXCEPTION 'unknown envelope extension unexpectedly passed';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint IS DISTINCT FROM 'payment_webhook_inbox_envelope_check' THEN RAISE; END IF;
  END;

  FOREACH v_key IN ARRAY ARRAY['event_type', 'provider_reference', 'receiver_reference', 'provider_customer_reference', 'provider_paid_at'] LOOP
    BEGIN
      UPDATE private.payment_webhook_source_manifests
      SET redacted_parent_source_identity = jsonb_set(v_parent, ARRAY[v_key], '1'::jsonb, true)
      WHERE id = v_manifest_id;
      RAISE EXCEPTION 'non-string redacted parent value unexpectedly passed: %', v_key;
    EXCEPTION WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint IS DISTINCT FROM 'payment_webhook_source_manifests_parent_identity_check' THEN RAISE; END IF;
    END;
  END LOOP;
  BEGIN
    UPDATE private.payment_webhook_source_manifests
    SET redacted_parent_source_identity = jsonb_set(v_parent, ARRAY['unknown_extension'], '"forbidden"'::jsonb, true)
    WHERE id = v_manifest_id;
    RAISE EXCEPTION 'unknown redacted parent extension unexpectedly passed';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint IS DISTINCT FROM 'payment_webhook_source_manifests_parent_identity_check' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO private.payment_webhook_source_proofs (
      source_manifest_id, child_identity, child_ordinal, capture_identity,
      amount_minor, currency, paid_time_precision, child_sha256, intake_decision,
      decided_at, decision_reason_code, review_scope_kind
    ) VALUES (
      v_manifest_id, 'singleton', 2, 'capture-2', 100, 'NGN', 'exact',
      repeat('9', 64), 'not_order_protecting', '2026-08-01 12:01:00+00',
      'duplicate_child', 'none'
    );
    RAISE EXCEPTION 'duplicate child identity unexpectedly passed';
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint IS DISTINCT FROM 'payment_webhook_source_proofs_manifest_child_uq' THEN RAISE; END IF;
  END;

  DELETE FROM private.payment_webhook_inbox WHERE id = v_inbox_id;
  IF (SELECT inbox_id FROM private.payment_webhook_source_manifests WHERE id = v_manifest_id) IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM private.payment_webhook_source_manifests WHERE id = v_manifest_id)
    OR NOT EXISTS (SELECT 1 FROM private.payment_webhook_source_proofs WHERE id = v_proof_id) THEN
    RAISE EXCEPTION 'inbox deletion must retain manifest and proof evidence while nulling only the operational link';
  END IF;

  BEGIN
    DELETE FROM private.payment_webhook_source_manifests WHERE id = v_manifest_id;
    RAISE EXCEPTION 'manifest deletion unexpectedly passed while a proof exists';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END;
$$;

ROLLBACK;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM private.payment_ingress_signature_key_identities
    WHERE id = '10000000-0000-4000-8000-000000000002'
  ) THEN
    RAISE EXCEPTION 'fixture identity row survived rollback';
  END IF;
  IF EXISTS (
    SELECT 1 FROM private.payment_ingress_contract_generations
    WHERE id = '10000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'fixture generation row survived rollback';
  END IF;
  IF EXISTS (
    SELECT 1 FROM private.payment_webhook_inbox
    WHERE id = '30000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'fixture inbox row survived rollback';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM private.payment_webhook_source_manifests
    WHERE id = ANY (ARRAY[
      '20000000-0000-4000-8000-000000000001'::uuid,
      '20000000-0000-4000-8000-000000000002'::uuid,
      '20000000-0000-4000-8000-000000000003'::uuid
    ])
  ) THEN
    RAISE EXCEPTION 'fixture manifest row survived rollback';
  END IF;
  IF EXISTS (
    SELECT 1 FROM private.payment_webhook_source_proofs
    WHERE id = '40000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'fixture proof row survived rollback';
  END IF;
  IF (SELECT count(*) FROM private.payment_webhook_inbox) <> 0
    OR (SELECT count(*) FROM private.payment_webhook_source_manifests) <> 0
    OR (SELECT count(*) FROM private.payment_webhook_source_proofs) <> 0
  THEN
    RAISE EXCEPTION 'payment webhook evidence relations must be empty after fixture rollback';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('payment_webhook_inbox_pkey', 'payment_webhook_inbox', ARRAY['id']::text[], true, true, NULL::text),
        ('payment_webhook_inbox_replay_key_uq', 'payment_webhook_inbox', ARRAY['replay_key_kind', 'replay_key_digest']::text[], true, false, NULL::text),
        ('payment_webhook_inbox_manifest_binding_uq', 'payment_webhook_inbox', ARRAY['id', 'source_manifest_id', 'replay_key_kind', 'replay_key_digest', 'provider', 'endpoint_key', 'signature_key_scope', 'completion_authority_key', 'signature_key_identity_id', 'ingress_contract_generation', 'adapter_schema_version', 'normalized_envelope_schema_version', 'replay_identity_contract_version']::text[], true, false, NULL::text),
        ('payment_webhook_inbox_processing_idx', 'payment_webhook_inbox', ARRAY['processing_status', 'received_at', 'id']::text[], false, false, NULL::text),
        ('payment_webhook_inbox_generation_idx', 'payment_webhook_inbox', ARRAY['ingress_contract_generation_id', 'id']::text[], false, false, NULL::text),
        ('payment_webhook_inbox_source_manifest_idx', 'payment_webhook_inbox', ARRAY['source_manifest_id', 'id']::text[], false, false, NULL::text),
        ('payment_webhook_source_manifests_pkey', 'payment_webhook_source_manifests', ARRAY['id']::text[], true, true, NULL::text),
        ('payment_webhook_source_manifests_replay_key_uq', 'payment_webhook_source_manifests', ARRAY['replay_key_kind', 'replay_key_digest']::text[], true, false, NULL::text),
        ('payment_webhook_source_manifests_inbox_target_uq', 'payment_webhook_source_manifests', ARRAY['id', 'replay_key_kind', 'replay_key_digest', 'provider', 'endpoint_key', 'signature_key_scope', 'completion_authority_key', 'signature_key_identity_id', 'ingress_contract_generation', 'adapter_schema_version', 'normalized_envelope_schema_version', 'replay_identity_contract_version']::text[], true, false, NULL::text),
        ('payment_webhook_source_manifests_binding_uq', 'payment_webhook_source_manifests', ARRAY['id', 'replay_key_kind', 'replay_key_digest', 'provider', 'endpoint_key', 'signature_key_scope', 'completion_authority_key', 'signature_key_identity_id', 'ingress_contract_generation', 'adapter_schema_version', 'normalized_envelope_schema_version', 'replay_identity_contract_version', 'currency']::text[], true, false, NULL::text),
        ('payment_webhook_source_manifests_currency_target_uq', 'payment_webhook_source_manifests', ARRAY['id', 'currency']::text[], true, false, NULL::text),
        ('payment_webhook_source_manifests_provider_account_idx', 'payment_webhook_source_manifests', ARRAY['provider', 'provider_account_scope', 'created_at', 'id']::text[], false, false, NULL::text),
        ('payment_webhook_source_manifests_generation_idx', 'payment_webhook_source_manifests', ARRAY['ingress_contract_generation_id', 'id']::text[], false, false, NULL::text),
        ('payment_webhook_source_manifests_inbox_idx', 'payment_webhook_source_manifests', ARRAY['inbox_id', 'id']::text[], false, false, '(inbox_id IS NOT NULL)'::text),
        ('payment_webhook_source_proofs_pkey', 'payment_webhook_source_proofs', ARRAY['id']::text[], true, true, NULL::text),
        ('payment_webhook_source_proofs_manifest_child_uq', 'payment_webhook_source_proofs', ARRAY['source_manifest_id', 'child_identity']::text[], true, false, NULL::text),
        ('payment_webhook_source_proofs_manifest_ordinal_uq', 'payment_webhook_source_proofs', ARRAY['source_manifest_id', 'child_ordinal']::text[], true, false, NULL::text),
        ('payment_webhook_source_proofs_manifest_capture_uq', 'payment_webhook_source_proofs', ARRAY['source_manifest_id', 'capture_identity']::text[], true, false, NULL::text),
        ('payment_webhook_source_proofs_decision_idx', 'payment_webhook_source_proofs', ARRAY['intake_decision', 'review_scope_kind', 'decided_at', 'id']::text[], false, false, NULL::text)
    ) AS expected(index_name, table_name, key_columns, is_unique, is_primary, predicate)
    LEFT JOIN pg_namespace index_namespace ON index_namespace.nspname = 'private'
    LEFT JOIN pg_class index_relation
      ON index_relation.relnamespace = index_namespace.oid
      AND index_relation.relname = expected.index_name
    LEFT JOIN pg_index index_catalog ON index_catalog.indexrelid = index_relation.oid
    LEFT JOIN pg_class table_relation ON table_relation.oid = index_catalog.indrelid
    LEFT JOIN pg_namespace table_namespace ON table_namespace.oid = table_relation.relnamespace
    LEFT JOIN LATERAL (
      SELECT array_agg(attribute.attname::text ORDER BY key_columns.ordinality) AS names
      FROM unnest(index_catalog.indkey) WITH ORDINALITY AS key_columns(attnum, ordinality)
      JOIN pg_attribute attribute
        ON attribute.attrelid = table_relation.oid
        AND attribute.attnum = key_columns.attnum
    ) AS actual_keys ON true
    WHERE index_relation.oid IS NULL
      OR table_namespace.nspname IS DISTINCT FROM 'private'
      OR table_relation.relname IS DISTINCT FROM expected.table_name
      OR index_catalog.indisunique IS DISTINCT FROM expected.is_unique
      OR index_catalog.indisprimary IS DISTINCT FROM expected.is_primary
      OR actual_keys.names IS DISTINCT FROM expected.key_columns
      OR COALESCE(pg_get_expr(index_catalog.indpred, index_catalog.indrelid), NULL) IS DISTINCT FROM expected.predicate
  ) THEN
    RAISE EXCEPTION 'payment webhook evidence index catalog changed after fixture rollback';
  END IF;
  IF EXISTS (
    WITH expected AS (
      SELECT 'payment_ingress_contract_generations'::text AS table_name,
        unnest(ARRAY['payment_ingress_contract_generations_evidence_binding_key']::text[]) AS constraint_name
      UNION ALL
      SELECT 'payment_webhook_inbox', unnest(ARRAY[
        'payment_webhook_inbox_pkey', 'payment_webhook_inbox_provider_check',
        'payment_webhook_inbox_endpoint_key_check', 'payment_webhook_inbox_signature_scope_check',
        'payment_webhook_inbox_authority_key_check', 'payment_webhook_inbox_generation_fkey',
        'payment_webhook_inbox_replay_kind_check', 'payment_webhook_inbox_replay_digest_check',
        'payment_webhook_inbox_replay_preimage_check', 'payment_webhook_inbox_ingress_scope_snapshot_check',
        'payment_webhook_inbox_envelope_check', 'payment_webhook_inbox_hashes_check',
        'payment_webhook_inbox_event_type_check', 'payment_webhook_inbox_reference_check',
        'payment_webhook_inbox_amount_currency_check', 'payment_webhook_inbox_manifest_check',
        'payment_webhook_inbox_processing_check', 'payment_webhook_inbox_error_check',
        'payment_webhook_inbox_decision_projection_check', 'payment_webhook_inbox_replay_key_uq',
        'payment_webhook_inbox_manifest_binding_uq', 'payment_webhook_inbox_source_manifest_fkey'
      ]::text[])
      UNION ALL
      SELECT 'payment_webhook_source_manifests', unnest(ARRAY[
        'payment_webhook_source_manifests_pkey', 'payment_webhook_source_manifests_provider_check',
        'payment_webhook_source_manifests_endpoint_key_check', 'payment_webhook_source_manifests_signature_scope_check',
        'payment_webhook_source_manifests_authority_key_check', 'payment_webhook_source_manifests_generation_fkey',
        'payment_webhook_source_manifests_replay_kind_check', 'payment_webhook_source_manifests_replay_digest_check',
        'payment_webhook_source_manifests_replay_preimage_check', 'payment_webhook_source_manifests_scope_snapshot_check',
        'payment_webhook_source_manifests_economics_check', 'payment_webhook_source_manifests_parent_identity_check',
        'payment_webhook_source_manifests_replay_key_uq', 'payment_webhook_source_manifests_inbox_target_uq',
        'payment_webhook_source_manifests_binding_uq', 'payment_webhook_source_manifests_currency_target_uq',
        'payment_webhook_source_manifests_inbox_fkey'
      ]::text[])
      UNION ALL
      SELECT 'payment_webhook_source_proofs', unnest(ARRAY[
        'payment_webhook_source_proofs_pkey', 'payment_webhook_source_proofs_manifest_fkey',
        'payment_webhook_source_proofs_child_identity_check', 'payment_webhook_source_proofs_ordinal_check',
        'payment_webhook_source_proofs_reference_check', 'payment_webhook_source_proofs_capture_identity_check',
        'payment_webhook_source_proofs_amount_check', 'payment_webhook_source_proofs_currency_fkey',
        'payment_webhook_source_proofs_paid_precision_check', 'payment_webhook_source_proofs_hash_check',
        'payment_webhook_source_proofs_decision_check', 'payment_webhook_source_proofs_reason_check',
        'payment_webhook_source_proofs_review_scope_check', 'payment_webhook_source_proofs_decision_shape_check',
        'payment_webhook_source_proofs_manifest_child_uq', 'payment_webhook_source_proofs_manifest_ordinal_uq',
        'payment_webhook_source_proofs_manifest_capture_uq'
      ]::text[])
    )
    SELECT 1
    FROM expected
    LEFT JOIN pg_constraint constraint_catalog
      ON constraint_catalog.conrelid = ('private.' || expected.table_name)::regclass
      AND constraint_catalog.conname = expected.constraint_name
    WHERE constraint_catalog.oid IS NULL
  ) THEN
    RAISE EXCEPTION 'payment webhook evidence named constraints changed or lost their relation scope after fixture rollback';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('payment_webhook_inbox', 'payment_webhook_inbox_pkey', 'PRIMARY KEY (id)'),
        ('payment_webhook_source_manifests', 'payment_webhook_source_manifests_pkey', 'PRIMARY KEY (id)'),
        ('payment_webhook_source_proofs', 'payment_webhook_source_proofs_pkey', 'PRIMARY KEY (id)')
    ) AS expected(table_name, constraint_name, definition)
    LEFT JOIN pg_constraint constraint_catalog
      ON constraint_catalog.conrelid = ('private.' || expected.table_name)::regclass
      AND constraint_catalog.conname = expected.constraint_name
    WHERE constraint_catalog.contype IS DISTINCT FROM 'p'
      OR regexp_replace(pg_get_constraintdef(constraint_catalog.oid), '\s+', ' ', 'g') IS DISTINCT FROM expected.definition
  ) THEN
    RAISE EXCEPTION 'payment webhook evidence primary-key constraints changed after fixture rollback';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('payment_webhook_inbox'),
        ('payment_webhook_source_manifests'),
        ('payment_webhook_source_proofs')
    ) AS expected(relation_name)
    LEFT JOIN pg_namespace schema ON schema.nspname = 'private'
    LEFT JOIN pg_class relation
      ON relation.relnamespace = schema.oid
      AND relation.relname = expected.relation_name
    WHERE relation.oid IS NULL
  )
    OR NOT EXISTS (
      SELECT 1
      FROM pg_class index_relation
      JOIN pg_namespace schema ON schema.oid = index_relation.relnamespace
      WHERE schema.nspname = 'private'
        AND index_relation.relname = 'payment_webhook_inbox_generation_idx'
    )
  THEN
    RAISE EXCEPTION 'migration catalog did not remain after fixture rollback';
  END IF;
END;
$$;
