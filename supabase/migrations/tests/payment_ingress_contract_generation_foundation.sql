-- Contract test for the dormant payment ingress generation registry.
-- Run after applying the pending migration as the first disposable replay SQL
-- check, followed by this assertion file as the second check.

BEGIN;

-- Intentionally query the relation before catalog inspection. Before its migration
-- is applied, this must fail as a missing relation rather than hide that failure
-- behind a synthetic test error.
SELECT count(*)
FROM private.payment_ingress_contract_generations;

DO $$
BEGIN
  IF (SELECT count(*) FROM private.payment_ingress_contract_generations) <> 0 THEN
    RAISE EXCEPTION 'payment ingress generation registry must start empty';
  END IF;
END;
$$;

DO $$
DECLARE
  v_table regclass := 'private.payment_ingress_contract_generations'::regclass;
  v_missing_column text;
  v_missing_constraint text;
  v_missing_index text;
  v_role text;
  v_id_staged uuid := '00000000-0000-4000-8000-000000000001';
  v_id_active uuid := '00000000-0000-4000-8000-000000000002';
  v_id_draining uuid := '00000000-0000-4000-8000-000000000003';
  v_id_successor uuid := '00000000-0000-4000-8000-000000000004';
  v_id_retired uuid := '00000000-0000-4000-8000-000000000005';
  v_id_retired_successor uuid := '00000000-0000-4000-8000-000000000006';
  v_id_fork_target uuid := '00000000-0000-4000-8000-000000000007';
  v_id_fork_first uuid := '00000000-0000-4000-8000-000000000008';
BEGIN
  SELECT expected.column_name
  INTO v_missing_column
  FROM (
    VALUES
      ('id'),
      ('provider'),
      ('endpoint_key'),
      ('signature_key_scope'),
      ('signature_key_identity_id'),
      ('authority_key'),
      ('generation'),
      ('parser_contract_version'),
      ('parser_artifact_sha256'),
      ('normalized_envelope_schema_version'),
      ('replay_identity_contract_version'),
      ('status'),
      ('control_version'),
      ('activated_at'),
      ('draining_at'),
      ('retired_at'),
      ('successor_generation_id'),
      ('created_at')
  ) AS expected(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'private'
      AND table_name = 'payment_ingress_contract_generations'
      AND column_name = expected.column_name
  )
  LIMIT 1;

  IF v_missing_column IS NOT NULL THEN
    RAISE EXCEPTION 'payment ingress generation column is missing: %', v_missing_column;
  END IF;

  IF (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'private'
      AND table_name = 'payment_ingress_contract_generations'
  ) <> 18 THEN
    RAISE EXCEPTION 'payment ingress generation registry must expose exactly 18 columns';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('id', 'uuid'),
        ('provider', 'text'),
        ('endpoint_key', 'text'),
        ('signature_key_scope', 'text'),
        ('signature_key_identity_id', 'uuid'),
        ('authority_key', 'text'),
        ('generation', 'bigint'),
        ('parser_contract_version', 'text'),
        ('parser_artifact_sha256', 'text'),
        ('normalized_envelope_schema_version', 'text'),
        ('replay_identity_contract_version', 'text'),
        ('status', 'text'),
        ('control_version', 'bigint'),
        ('activated_at', 'timestamp with time zone'),
        ('draining_at', 'timestamp with time zone'),
        ('retired_at', 'timestamp with time zone'),
        ('successor_generation_id', 'uuid'),
        ('created_at', 'timestamp with time zone')
    ) AS expected(column_name, data_type)
    LEFT JOIN information_schema.columns actual
      ON actual.table_schema = 'private'
      AND actual.table_name = 'payment_ingress_contract_generations'
      AND actual.column_name = expected.column_name
    WHERE actual.data_type IS DISTINCT FROM expected.data_type
  ) THEN
    RAISE EXCEPTION 'payment ingress generation column types do not match the frozen contract';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'private'
      AND table_name = 'payment_ingress_contract_generations'
      AND column_name IN (
        'id', 'provider', 'endpoint_key', 'signature_key_scope',
        'signature_key_identity_id', 'authority_key', 'generation',
        'parser_contract_version', 'parser_artifact_sha256',
        'normalized_envelope_schema_version', 'replay_identity_contract_version',
        'status', 'control_version', 'created_at'
      )
      AND is_nullable <> 'NO'
  ) THEN
    RAISE EXCEPTION 'payment ingress generation required columns must be NOT NULL';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_attrdef
    WHERE adrelid = v_table
  ) <> 4
  OR EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('id', 'gen_random_uuid()'),
        ('status', '''staged''::text'),
        ('control_version', '1'),
        ('created_at', 'now()')
    ) AS expected(attname, default_expression)
    LEFT JOIN pg_attribute actual_attr
      ON actual_attr.attrelid = v_table
      AND actual_attr.attname = expected.attname
    LEFT JOIN pg_attrdef actual_def
      ON actual_def.adrelid = v_table
      AND actual_def.adnum = actual_attr.attnum
    WHERE actual_attr.attname IS NULL
      OR pg_get_expr(actual_def.adbin, actual_def.adrelid) IS DISTINCT FROM
        expected.default_expression
  )
  OR EXISTS (
    SELECT 1
    FROM pg_attrdef actual_def
    JOIN pg_attribute actual_attr
      ON actual_attr.attrelid = actual_def.adrelid
      AND actual_attr.attnum = actual_def.adnum
    WHERE actual_def.adrelid = v_table
      AND actual_attr.attname NOT IN ('id', 'status', 'control_version', 'created_at')
  ) THEN
    RAISE EXCEPTION 'payment ingress generation defaults do not match the frozen column-bound contract';
  END IF;

  SELECT expected.name
  INTO v_missing_constraint
  FROM (
    VALUES
      ('payment_ingress_contract_generations_provider_check'),
      ('payment_ingress_contract_generations_endpoint_key_check'),
      ('payment_ingress_contract_generations_signature_scope_check'),
      ('payment_ingress_contract_generations_authority_key_check'),
      ('payment_ingress_contract_generations_generation_check'),
      ('payment_ingress_contract_generations_control_version_check'),
      ('payment_ingress_contract_generations_parser_contract_check'),
      ('payment_ingress_contract_generations_parser_artifact_check'),
      ('payment_ingress_contract_generations_envelope_schema_check'),
      ('payment_ingress_contract_generations_replay_identity_check'),
      ('payment_ingress_contract_generations_status_check'),
      ('payment_ingress_contract_generations_lifecycle_check'),
      ('payment_ingress_contract_generations_timestamps_check'),
      ('payment_ingress_contract_generations_successor_not_self_check'),
      ('payment_ingress_contract_generations_scope_generation_key'),
      ('payment_ingress_contract_generations_identity_scope_key'),
      ('payment_ingress_contract_generations_identity_artifact_scope_uq'),
      ('payment_ingress_contract_generations_successor_fkey')
  ) AS expected(name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = v_table
      AND conname = expected.name
  )
  LIMIT 1;

  IF v_missing_constraint IS NOT NULL THEN
    RAISE EXCEPTION 'payment ingress generation constraint is missing: %', v_missing_constraint;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = v_table
      AND conname = 'payment_ingress_contract_generations_successor_fkey'
      AND contype = 'f'
      AND condeferrable
      AND condeferred
      AND pg_get_constraintdef(oid) LIKE
        'FOREIGN KEY (successor_generation_id, provider, endpoint_key, signature_key_scope, authority_key) REFERENCES private.payment_ingress_contract_generations(id, provider, endpoint_key, signature_key_scope, authority_key)%'
  ) THEN
    RAISE EXCEPTION 'payment ingress generation successor FK is not the frozen deferred same-scope FK';
  END IF;

  SELECT expected.name
  INTO v_missing_index
  FROM (
    VALUES
      ('payment_ingress_contract_generations_scope_generation_key'),
      ('payment_ingress_contract_generations_identity_scope_key'),
      ('payment_ingress_contract_generations_identity_artifact_scope_uq'),
      ('payment_ingress_contract_generations_successor_uidx'),
      ('payment_ingress_contract_generations_one_active_uidx'),
      ('payment_ingress_contract_generations_scope_status_idx')
  ) AS expected(name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'private'
      AND tablename = 'payment_ingress_contract_generations'
      AND indexname = expected.name
  )
  LIMIT 1;

  IF v_missing_index IS NOT NULL THEN
    RAISE EXCEPTION 'payment ingress generation index is missing: %', v_missing_index;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'private'
      AND indexname = 'payment_ingress_contract_generations_successor_uidx'
      AND indexdef LIKE '%UNIQUE% (successor_generation_id) WHERE (successor_generation_id IS NOT NULL)%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'private'
      AND indexname = 'payment_ingress_contract_generations_one_active_uidx'
      AND indexdef LIKE '%UNIQUE% (provider, endpoint_key, signature_key_scope, authority_key) WHERE (status = ''active''::text)%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'private'
      AND indexname = 'payment_ingress_contract_generations_scope_status_idx'
      AND indexdef LIKE '%(provider, endpoint_key, signature_key_scope, authority_key, status, generation DESC)%'
  ) THEN
    RAISE EXCEPTION 'payment ingress generation index definitions do not match the frozen contract';
  END IF;

  IF obj_description(v_table, 'pg_class') IS DISTINCT FROM
    'Pre-tenant, endpoint-scoped, non-financial ingress contract registry; contains no secrets and grants no completion authority.'
  THEN
    RAISE EXCEPTION 'payment ingress generation table comment is missing or incorrect';
  END IF;

  IF col_description(v_table, 5) IS DISTINCT FROM
    'Opaque non-secret identity; deliberately unbound until the reviewed identity catalog and guarded creator land.'
    OR col_description(v_table, 6) IS DISTINCT FROM
      'Classifier only, never a completion-authority grant.'
    OR col_description(v_table, 17) IS DISTINCT FROM
      'Forward-only, same-scope successor; no writer exists in this slice.'
  THEN
    RAISE EXCEPTION 'payment ingress generation column comments are missing or incorrect';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE oid = v_table
      AND relrowsecurity
      AND relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'payment ingress generation registry must enable and force RLS';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = v_table) THEN
    RAISE EXCEPTION 'payment ingress generation registry must not define a policy';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class registry
    CROSS JOIN LATERAL aclexplode(
      COALESCE(registry.relacl, acldefault('r', registry.relowner))
    ) AS privilege
    WHERE registry.oid = v_table
      AND privilege.grantee = 0
  ) THEN
    RAISE EXCEPTION 'payment ingress generation registry must deny all direct table privileges to PUBLIC';
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF has_table_privilege(v_role, v_table, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') THEN
      RAISE EXCEPTION 'payment ingress generation registry must deny all direct table privileges to %', v_role;
    END IF;
  END LOOP;

  IF to_regclass('private.payment_ingress_contract_transition_receipts') IS NOT NULL
    OR to_regclass('private.payment_ingress_parser_compatibility_proofs') IS NOT NULL
    OR to_regclass('private.payment_ingress_signature_key_identities') IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM pg_proc
      WHERE pronamespace = 'private'::regnamespace
        AND proname LIKE 'payment_ingress_contract_generation%'
    )
  THEN
    RAISE EXCEPTION 'payment ingress generation foundation must not add later-slice relations or writers';
  END IF;

  INSERT INTO private.payment_ingress_contract_generations (
    id, provider, endpoint_key, signature_key_scope, signature_key_identity_id,
    authority_key, generation, parser_contract_version, parser_artifact_sha256,
    normalized_envelope_schema_version, replay_identity_contract_version
  ) VALUES (
    v_id_staged, 'provider', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000101',
    'authority', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1'
  );

  INSERT INTO private.payment_ingress_contract_generations (
    id, provider, endpoint_key, signature_key_scope, signature_key_identity_id,
    authority_key, generation, parser_contract_version, parser_artifact_sha256,
    normalized_envelope_schema_version, replay_identity_contract_version, status, activated_at
  ) VALUES (
    v_id_active, 'provider', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000102',
    'authority', 2, 'parser-v1', repeat('b', 64), 'envelope-v1', 'replay-v1', 'active',
    '2026-07-31 10:00:00+00'
  );

  INSERT INTO private.payment_ingress_contract_generations (
    id, provider, endpoint_key, signature_key_scope, signature_key_identity_id,
    authority_key, generation, parser_contract_version, parser_artifact_sha256,
    normalized_envelope_schema_version, replay_identity_contract_version, status,
    activated_at, draining_at, successor_generation_id
  ) VALUES (
    v_id_draining, 'provider', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000103',
    'authority', 3, 'parser-v1', repeat('c', 64), 'envelope-v1', 'replay-v1', 'draining',
    '2026-07-31 10:00:00+00', '2026-07-31 11:00:00+00', v_id_successor
  );

  INSERT INTO private.payment_ingress_contract_generations (
    id, provider, endpoint_key, signature_key_scope, signature_key_identity_id,
    authority_key, generation, parser_contract_version, parser_artifact_sha256,
    normalized_envelope_schema_version, replay_identity_contract_version
  ) VALUES (
    v_id_successor, 'provider', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000104',
    'authority', 4, 'parser-v1', repeat('d', 64), 'envelope-v1', 'replay-v1'
  );

  INSERT INTO private.payment_ingress_contract_generations (
    id, provider, endpoint_key, signature_key_scope, signature_key_identity_id,
    authority_key, generation, parser_contract_version, parser_artifact_sha256,
    normalized_envelope_schema_version, replay_identity_contract_version, status,
    activated_at, draining_at, retired_at, successor_generation_id
  ) VALUES (
    v_id_retired, 'provider', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000105',
    'authority', 5, 'parser-v1', repeat('e', 64), 'envelope-v1', 'replay-v1', 'retired',
    '2026-07-31 10:00:00+00', '2026-07-31 11:00:00+00', '2026-07-31 12:00:00+00',
    v_id_retired_successor
  );

  INSERT INTO private.payment_ingress_contract_generations (
    id, provider, endpoint_key, signature_key_scope, signature_key_identity_id,
    authority_key, generation, parser_contract_version, parser_artifact_sha256,
    normalized_envelope_schema_version, replay_identity_contract_version
  ) VALUES (
    v_id_retired_successor, 'provider', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000106',
    'authority', 6, 'parser-v1', repeat('f', 64), 'envelope-v1', 'replay-v1'
  );

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version
    ) VALUES (
      'Provider', 'endpoint-invalid', 'signature-invalid', '00000000-0000-4000-8000-000000000107',
      'authority-invalid', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1'
    );
    RAISE EXCEPTION 'uppercase provider unexpectedly passed canonical-key validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version
    ) VALUES (
      'provider-invalid', 'endpoint/invalid', 'signature-invalid', '00000000-0000-4000-8000-000000000108',
      'authority-invalid', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1'
    );
    RAISE EXCEPTION 'invalid endpoint key unexpectedly passed canonical-key validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version
    ) VALUES (
      'provider-invalid', 'endpoint-invalid', '1signature', '00000000-0000-4000-8000-000000000109',
      'authority-invalid', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1'
    );
    RAISE EXCEPTION 'invalid signature scope unexpectedly passed canonical-key validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version
    ) VALUES (
      'provider-invalid', 'endpoint-invalid', 'signature-invalid', '00000000-0000-4000-8000-000000000110',
      '-authority', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1'
    );
    RAISE EXCEPTION 'invalid authority key unexpectedly passed canonical-key validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version
    ) VALUES (
      'versions-one', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000111',
      'authority', 1, ' parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1'
    );
    RAISE EXCEPTION 'untrimmed parser version unexpectedly passed validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version
    ) VALUES (
      'versions-two', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000112',
      'authority', 1, 'parser-v1', repeat('a', 64), '', 'replay-v1'
    );
    RAISE EXCEPTION 'empty envelope version unexpectedly passed validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version
    ) VALUES (
      'versions-three', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000113',
      'authority', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', repeat('r', 256)
    );
    RAISE EXCEPTION 'overlong replay version unexpectedly passed validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version
    ) VALUES (
      'hash-invalid', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000114',
      'authority', 1, 'parser-v1', repeat('A', 64), 'envelope-v1', 'replay-v1'
    );
    RAISE EXCEPTION 'uppercase parser artifact hash unexpectedly passed validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version
    ) VALUES (
      'number-invalid', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000115',
      'authority', 0, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1'
    );
    RAISE EXCEPTION 'nonpositive generation unexpectedly passed validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version, control_version
    ) VALUES (
      'control-invalid', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000116',
      'authority', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1', 0
    );
    RAISE EXCEPTION 'nonpositive control version unexpectedly passed validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version, status, activated_at
    ) VALUES (
      'lifecycle-staged', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000117',
      'authority', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1', 'staged', now()
    );
    RAISE EXCEPTION 'staged lifecycle shape unexpectedly passed validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version, status
    ) VALUES (
      'lifecycle-active', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000118',
      'authority', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1', 'active'
    );
    RAISE EXCEPTION 'active lifecycle shape unexpectedly passed validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version, status, activated_at, draining_at
    ) VALUES (
      'lifecycle-draining', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000119',
      'authority', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1', 'draining', now(), now()
    );
    RAISE EXCEPTION 'draining lifecycle shape unexpectedly passed validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version, status, activated_at, draining_at, retired_at
    ) VALUES (
      'lifecycle-retired', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000120',
      'authority', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1', 'retired', now(), now(), now()
    );
    RAISE EXCEPTION 'retired lifecycle shape unexpectedly passed validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version, status,
      activated_at, draining_at, successor_generation_id
    ) VALUES (
      'timestamp-drain', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000121',
      'authority', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1', 'draining',
      '2026-07-31 11:00:00+00', '2026-07-31 10:00:00+00', v_id_staged
    );
    RAISE EXCEPTION 'drain-before-activation unexpectedly passed validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version, status,
      activated_at, draining_at, retired_at, successor_generation_id
    ) VALUES (
      'timestamp-retire', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000122',
      'authority', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1', 'retired',
      '2026-07-31 10:00:00+00', '2026-07-31 12:00:00+00', '2026-07-31 11:00:00+00', v_id_staged
    );
    RAISE EXCEPTION 'retirement-before-draining unexpectedly passed validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version
    ) VALUES (
      'provider', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000123',
      'authority', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1'
    );
    RAISE EXCEPTION 'duplicate scope generation unexpectedly passed validation';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version, status, activated_at
    ) VALUES (
      'provider', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000124',
      'authority', 7, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1', 'active', now()
    );
    RAISE EXCEPTION 'second active scope generation unexpectedly passed validation';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      id, provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version, status,
      activated_at, draining_at, successor_generation_id
    ) VALUES (
      '00000000-0000-4000-8000-000000000125', 'self-successor', 'endpoint', 'signature',
      '00000000-0000-4000-8000-000000000125', 'authority', 1, 'parser-v1', repeat('a', 64),
      'envelope-v1', 'replay-v1', 'draining', now(), now(), '00000000-0000-4000-8000-000000000125'
    );
    RAISE EXCEPTION 'self successor unexpectedly passed validation';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      id, provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version
    ) VALUES (
      '00000000-0000-4000-8000-000000000126', 'cross-target', 'endpoint', 'signature',
      '00000000-0000-4000-8000-000000000126', 'authority', 1, 'parser-v1', repeat('a', 64),
      'envelope-v1', 'replay-v1'
    );
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version, status,
      activated_at, draining_at, successor_generation_id
    ) VALUES (
      'cross-source', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000127',
      'authority', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1', 'draining',
      now(), now(), '00000000-0000-4000-8000-000000000126'
    );
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'cross-scope successor unexpectedly passed validation';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  INSERT INTO private.payment_ingress_contract_generations (
    id, provider, endpoint_key, signature_key_scope, signature_key_identity_id,
    authority_key, generation, parser_contract_version, parser_artifact_sha256,
    normalized_envelope_schema_version, replay_identity_contract_version
  ) VALUES (
    v_id_fork_target, 'fork-scope', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000128',
    'authority', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1'
  );

  INSERT INTO private.payment_ingress_contract_generations (
    id, provider, endpoint_key, signature_key_scope, signature_key_identity_id,
    authority_key, generation, parser_contract_version, parser_artifact_sha256,
    normalized_envelope_schema_version, replay_identity_contract_version, status,
    activated_at, draining_at, successor_generation_id
  ) VALUES (
    v_id_fork_first, 'fork-scope', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000129',
    'authority', 2, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1', 'draining',
    now(), now(), v_id_fork_target
  );

  BEGIN
    INSERT INTO private.payment_ingress_contract_generations (
      provider, endpoint_key, signature_key_scope, signature_key_identity_id,
      authority_key, generation, parser_contract_version, parser_artifact_sha256,
      normalized_envelope_schema_version, replay_identity_contract_version, status,
      activated_at, draining_at, successor_generation_id
    ) VALUES (
      'fork-scope', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000130',
      'authority', 3, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1', 'draining',
      now(), now(), v_id_fork_target
    );
    RAISE EXCEPTION 'forked successor unexpectedly passed validation';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  INSERT INTO private.payment_ingress_contract_generations (
    provider, endpoint_key, signature_key_scope, signature_key_identity_id,
    authority_key, generation, parser_contract_version, parser_artifact_sha256,
    normalized_envelope_schema_version, replay_identity_contract_version
  ) VALUES (
    'separate-provider', 'endpoint', 'signature', '00000000-0000-4000-8000-000000000131',
    'authority', 1, 'parser-v1', repeat('a', 64), 'envelope-v1', 'replay-v1'
  );

  SET CONSTRAINTS ALL IMMEDIATE;
END;
$$;

ROLLBACK;
