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
  )
  LIMIT 1;

  IF v_missing_constraint IS NOT NULL THEN
    RAISE EXCEPTION 'payment webhook evidence constraint is missing: %', v_missing_constraint;
  END IF;

  SELECT expected.name INTO v_missing_index
  FROM (
    VALUES
      ('payment_webhook_inbox_replay_key_uq'), ('payment_webhook_inbox_manifest_binding_uq'),
      ('payment_webhook_inbox_processing_idx'), ('payment_webhook_source_manifests_replay_key_uq'),
      ('payment_webhook_source_manifests_inbox_target_uq'), ('payment_webhook_source_manifests_binding_uq'),
      ('payment_webhook_source_manifests_currency_target_uq'),
      ('payment_webhook_source_manifests_provider_account_idx'),
      ('payment_webhook_source_proofs_manifest_child_uq'),
      ('payment_webhook_source_proofs_manifest_ordinal_uq'),
      ('payment_webhook_source_proofs_manifest_capture_uq'),
      ('payment_webhook_source_proofs_decision_idx')
  ) AS expected(name)
  WHERE NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = expected.name)
  LIMIT 1;

  IF v_missing_index IS NOT NULL THEN
    RAISE EXCEPTION 'payment webhook evidence index is missing: %', v_missing_index;
  END IF;
END;
$$;

DO $$
DECLARE
  v_generation_id uuid := '10000000-0000-4000-8000-000000000001';
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_webhook_inbox_source_manifest_fkey'
      AND condeferrable AND condeferred
      AND pg_get_constraintdef(oid) LIKE '%ON DELETE RESTRICT%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_webhook_source_manifests_inbox_fkey'
      AND condeferrable AND condeferred
      AND pg_get_constraintdef(oid) LIKE '%ON DELETE SET NULL (inbox_id)%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_webhook_source_proofs_currency_fkey'
      AND condeferrable AND condeferred
      AND pg_get_constraintdef(oid) LIKE '%REFERENCES private.payment_webhook_source_manifests(id, currency)%'
  ) THEN
    RAISE EXCEPTION 'payment webhook evidence foreign keys do not match the deferred retention contract';
  END IF;

  INSERT INTO private.payment_ingress_contract_generations (
    id, provider, endpoint_key, signature_key_scope, signature_key_identity_id,
    authority_key, generation, parser_contract_version, parser_artifact_sha256,
    normalized_envelope_schema_version, replay_identity_contract_version
  ) VALUES (
    v_generation_id, 'provider', 'endpoint', 'signature',
    '10000000-0000-4000-8000-000000000002', 'authority', 1, 'adapter-v1',
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
    '10000000-0000-4000-8000-000000000002', v_generation_id, 1, 'adapter-v1',
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
    '10000000-0000-4000-8000-000000000002', v_generation_id, 1, 'adapter-v1',
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
      '10000000-0000-4000-8000-000000000002', v_generation_id, 1, 'adapter-v1', 'envelope-v1', 'replay-v1',
      'account_reference', repeat('1', 64),
      '{"v":1,"kind":"account_reference","provider":"provider","completion_authority_key":"authority","provider_account_scope":"__unresolved__","provider_reference":"reference-1","event_type":"payment.received"}'::jsonb,
      v_scope, 'singleton', repeat('2', 64), 1, 100, 'NGN', 100, '{}'::jsonb),
    ('20000000-0000-4000-8000-000000000003', 'provider', 'endpoint', 'signature', 'authority',
      '10000000-0000-4000-8000-000000000002', v_generation_id, 1, 'adapter-v1', 'envelope-v1', 'replay-v1',
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
