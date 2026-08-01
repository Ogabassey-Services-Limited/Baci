-- Contract test for the dormant payment-ingress control-plane companion.
-- The first query intentionally fails before the companion migration exists.

BEGIN;

SELECT count(*)
FROM private.payment_ingress_signature_key_identities;

DO $$
DECLARE
  v_relation text;
  v_role text;
  v_function text;
  v_attestation_id uuid := '10000000-0000-4000-8000-000000000001';
  v_identity_id uuid := '10000000-0000-4000-8000-000000000002';
  v_binding_id uuid := '10000000-0000-4000-8000-000000000003';
  v_generation_one uuid := '10000000-0000-4000-8000-000000000004';
  v_generation_two uuid := '10000000-0000-4000-8000-000000000005';
  v_proof_id uuid := '10000000-0000-4000-8000-000000000006';
  v_creation_operation uuid := '10000000-0000-4000-8000-000000000007';
  v_transition_operation uuid := '10000000-0000-4000-8000-000000000008';
  v_approver_id uuid := '10000000-0000-4000-8000-000000000011';
  v_now timestamptz := clock_timestamp();
BEGIN
  FOREACH v_relation IN ARRAY ARRAY[
    'payment_ingress_signature_key_identities',
    'payment_ingress_deployment_attestations',
    'payment_ingress_deployment_manifest_bindings',
    'payment_ingress_parser_compatibility_proofs',
    'payment_ingress_contract_creation_receipts',
    'payment_ingress_contract_transition_receipts'
  ] LOOP
    IF to_regclass('private.' || v_relation) IS NULL THEN
      RAISE EXCEPTION 'payment ingress companion relation is missing: %', v_relation;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_class
      WHERE oid = ('private.' || v_relation)::regclass
        AND relrowsecurity AND relforcerowsecurity
    ) OR EXISTS (
      SELECT 1 FROM pg_policy
      WHERE polrelid = ('private.' || v_relation)::regclass
    ) THEN
      RAISE EXCEPTION 'companion relation must be forced-RLS and policy-free: %', v_relation;
    END IF;

    FOREACH v_role IN ARRAY ARRAY[
      'PUBLIC', 'anon', 'authenticated', 'service_role', 'payment_control_plane'
    ] LOOP
      IF v_role = 'PUBLIC' AND EXISTS (
        SELECT 1
        FROM pg_class AS relation
        CROSS JOIN LATERAL aclexplode(
          COALESCE(relation.relacl, acldefault('r', relation.relowner))
        ) AS privilege
        WHERE relation.oid = ('private.' || v_relation)::regclass
          AND privilege.grantee = 0
      ) THEN
        RAISE EXCEPTION 'companion relation grants direct access to PUBLIC: %', v_relation;
      ELSIF v_role <> 'PUBLIC' AND has_table_privilege(
        v_role, ('private.' || v_relation)::regclass,
        'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
      ) THEN
        RAISE EXCEPTION 'companion relation grants direct access to %: %', v_role, v_relation;
      END IF;
    END LOOP;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'payment_control_plane'
      AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolinherit AND NOT rolreplication
  ) THEN
    RAISE EXCEPTION 'payment_control_plane must be the exact no-login executor role';
  END IF;

  FOREACH v_function IN ARRAY ARRAY[
    'create_payment_ingress_contract_generation(uuid,uuid)',
    'activate_payment_ingress_contract_generation(uuid,uuid,bigint,uuid)',
    'roll_forward_payment_ingress_contract_generation(uuid,uuid,bigint,uuid,uuid)',
    'rollback_payment_ingress_contract_generation(uuid,uuid,bigint,uuid,uuid)',
    'retire_payment_ingress_contract_generation(uuid,uuid,bigint,uuid)'
  ] LOOP
    IF to_regprocedure('private.' || v_function) IS NULL
      OR NOT has_function_privilege('payment_control_plane', 'private.' || v_function, 'EXECUTE')
      OR has_function_privilege('service_role', 'private.' || v_function, 'EXECUTE')
      OR has_function_privilege('authenticated', 'private.' || v_function, 'EXECUTE')
      OR has_function_privilege('anon', 'private.' || v_function, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'companion function ACL/shape is wrong: %', v_function;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM private.payment_ingress_signature_key_identities) <> 0
    OR (SELECT count(*) FROM private.payment_ingress_deployment_attestations) <> 0
    OR (SELECT count(*) FROM private.payment_ingress_deployment_manifest_bindings) <> 0
    OR (SELECT count(*) FROM private.payment_ingress_parser_compatibility_proofs) <> 0
    OR (SELECT count(*) FROM private.payment_ingress_contract_creation_receipts) <> 0
    OR (SELECT count(*) FROM private.payment_ingress_contract_transition_receipts) <> 0
    OR EXISTS (
      SELECT 1 FROM private.payment_ingress_contract_generations
      WHERE status = 'active'
    ) THEN
    RAISE EXCEPTION 'companion migration must not seed control-plane state';
  END IF;

  IF (
    SELECT array_agg(column_name::text ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'private'
      AND table_name = 'payment_ingress_signature_key_identities'
  ) IS DISTINCT FROM ARRAY[
    'id', 'provider', 'endpoint_key', 'signature_key_scope', 'identity_revision',
    'identity_kind', 'material_fingerprint', 'provenance_reference', 'created_at'
  ] THEN
    RAISE EXCEPTION 'identity catalog must expose exactly the frozen non-secret fields';
  END IF;

  IF (
    SELECT array_agg(column_name::text ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'private'
      AND table_name = 'payment_ingress_deployment_attestations'
  ) IS DISTINCT FROM ARRAY[
    'id', 'environment', 'manifest_sha256', 'attestation_sha256', 'verified_by',
    'approval_reference', 'verified_at', 'retention_until', 'revoked_at',
    'revocation_reference', 'created_at'
  ] THEN
    RAISE EXCEPTION 'attestation root fields do not match the amendment';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'private.payment_ingress_deployment_attestations'::regclass
      AND conname = 'payment_ingress_deployment_attestations_revocation_pair_check'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'private.payment_ingress_deployment_attestations'::regclass
      AND tgname = 'payment_ingress_deployment_attestations_write_once_trigger'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'attestation root must have the named revocation guard';
  END IF;

  INSERT INTO private.payment_ingress_signature_key_identities (
    id, provider, endpoint_key, signature_key_scope, identity_revision, identity_kind,
    material_fingerprint, provenance_reference
  ) VALUES (
    v_identity_id, 'provider', 'endpoint', 'signature', 1, 'public_key',
    repeat('a', 64), 'migration-fixture'
  );

  INSERT INTO auth.users (id, email)
  VALUES (v_approver_id, 'payment-ingress-companion@example.test');

  INSERT INTO private.payment_ingress_deployment_attestations (
    id, environment, manifest_sha256, attestation_sha256, verified_by,
    approval_reference, verified_at, retention_until
  ) VALUES (
    v_attestation_id, 'test', repeat('b', 64), repeat('c', 64), 'migration',
    'migration-fixture', clock_timestamp(), clock_timestamp() + interval '1 day'
  );

  INSERT INTO private.payment_ingress_deployment_manifest_bindings (
    id, environment, provider, endpoint_key, signature_key_scope, authority_key,
    signature_key_identity_id, identity_revision, attestation_id,
    parser_contract_version, normalized_envelope_schema_version,
    replay_identity_contract_version, parser_artifact_sha256, manifest_sha256,
    attestation_sha256, verifier_artifact_sha256, corpus_manifest_sha256,
    normalized_envelope_equivalence_contract_version,
    replay_identity_equivalence_contract_version, provenance_reference,
    approval_reference, retention_until
  ) VALUES (
    v_binding_id, 'test', 'provider', 'endpoint', 'signature', 'authority',
    v_identity_id, 1, v_attestation_id, 'parser-v1', 'envelope-v1', 'replay-v1',
    repeat('d', 64), repeat('b', 64), repeat('c', 64), repeat('e', 64),
    repeat('f', 64), 'equivalence-envelope-v1', 'equivalence-replay-v1',
    'migration-fixture', 'migration-fixture', clock_timestamp() + interval '1 day'
  );

  INSERT INTO private.payment_ingress_contract_generations (
    id, provider, endpoint_key, signature_key_scope, signature_key_identity_id,
    authority_key, generation, parser_contract_version, parser_artifact_sha256,
    normalized_envelope_schema_version, replay_identity_contract_version
  ) VALUES (
    v_generation_one, 'provider', 'endpoint', 'signature', v_identity_id,
    'authority', 1, 'parser-v1', repeat('d', 64), 'envelope-v1', 'replay-v1'
  ), (
    v_generation_two, 'provider', 'endpoint', 'signature', v_identity_id,
    'authority', 2, 'parser-v2', repeat('e', 64), 'envelope-v2', 'replay-v2'
  );

  INSERT INTO private.payment_ingress_parser_compatibility_proofs (
    id, provider, endpoint_key, signature_key_scope, authority_key,
    basis_generation_id, candidate_generation_id, basis_parser_artifact_sha256,
    candidate_parser_artifact_sha256,
    normalized_envelope_equivalence_contract_version,
    replay_identity_equivalence_contract_version, verifier_artifact_sha256,
    corpus_manifest_sha256, proof_sha256, result, approved_by, approval_reference
  ) VALUES (
    v_proof_id, 'provider', 'endpoint', 'signature', 'authority',
    v_generation_one, v_generation_two, repeat('d', 64), repeat('e', 64),
    'equivalence-envelope-v1', 'equivalence-replay-v1', repeat('e', 64),
    repeat('f', 64), repeat('0', 64), 'compatible', v_approver_id, 'migration-fixture'
  );

  INSERT INTO private.payment_ingress_contract_creation_receipts (
    operation_id, request_fingerprint, deployment_binding_id, generation_id,
    provider, endpoint_key, signature_key_scope, authority_key, generation
  ) VALUES (
    v_creation_operation, repeat('1', 64), v_binding_id, v_generation_one,
    'provider', 'endpoint', 'signature', 'authority', 1
  );

  INSERT INTO private.payment_ingress_contract_transition_receipts (
    operation_id, request_fingerprint, provider, endpoint_key, signature_key_scope,
    authority_key, operation_kind, incoming_generation_id,
    incoming_expected_control_version, incoming_result_control_version,
    incoming_from_status, incoming_to_status, incoming_expected_activated_at,
    incoming_result_activated_at, incoming_expected_draining_at,
    incoming_result_draining_at, incoming_expected_retired_at,
    incoming_result_retired_at, incoming_expected_successor_generation_id,
    incoming_result_successor_generation_id, deployment_binding_id, actor_kind,
    actor_reference, approval_reference, evidence_reference, evidence_sha256,
    metrics_snapshot, reason_code, recorded_at, compatibility_basis_generation_id,
    compatibility_proof_id
  ) VALUES (
    v_transition_operation, repeat('2', 64), 'provider', 'endpoint', 'signature',
    'authority', 'initial_activate', v_generation_one, 1, 2, 'staged', 'active',
    NULL, v_now, NULL, NULL, NULL, NULL, NULL, NULL, v_binding_id,
    'service', 'payment_control_plane', 'migration-fixture', repeat('c', 64),
    repeat('c', 64), '{}'::jsonb, 'initial_activate', v_now, NULL, NULL
  );

  BEGIN
    INSERT INTO private.payment_ingress_signature_key_identities (
      provider, endpoint_key, signature_key_scope, identity_revision, identity_kind,
      material_fingerprint, provenance_reference
    ) VALUES ('provider', 'endpoint', 'signature', 1, 'public_key', repeat('a', 64), 'duplicate');
    RAISE EXCEPTION 'duplicate identity revision unexpectedly passed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_signature_key_identities (
      provider, endpoint_key, signature_key_scope, identity_revision, identity_kind,
      material_fingerprint, provenance_reference
    ) VALUES ('Provider', 'endpoint', 'signature', 0, 'secret', repeat('A', 64), ' ');
    RAISE EXCEPTION 'malformed identity unexpectedly passed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  UPDATE private.payment_ingress_deployment_attestations
  SET revoked_at = clock_timestamp(), revocation_reference = 'revoked-by-migration'
  WHERE id = v_attestation_id;

  BEGIN
    UPDATE private.payment_ingress_deployment_attestations
    SET revocation_reference = 'rewritten'
    WHERE id = v_attestation_id;
    RAISE EXCEPTION 'attestation revocation rewrite unexpectedly passed';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM NOT LIKE '%write-once%' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE private.payment_ingress_deployment_attestations
    SET revoked_at = NULL, revocation_reference = NULL
    WHERE id = v_attestation_id;
    RAISE EXCEPTION 'attestation revocation clearing unexpectedly passed';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    IF SQLERRM NOT LIKE '%write-once%' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_parser_compatibility_proofs (
      provider, endpoint_key, signature_key_scope, authority_key, basis_generation_id,
      candidate_generation_id, basis_parser_artifact_sha256,
      candidate_parser_artifact_sha256,
      normalized_envelope_equivalence_contract_version,
      replay_identity_equivalence_contract_version, verifier_artifact_sha256,
      corpus_manifest_sha256, proof_sha256, result, approved_by, approval_reference
    ) VALUES (
      'provider', 'endpoint', 'signature', 'authority', v_generation_two,
      v_generation_one, repeat('e', 64), repeat('d', 64), 'equivalence-envelope-v1',
      'equivalence-replay-v1', repeat('e', 64), repeat('f', 64), repeat('0', 64),
      'incompatible', NULL, 'invalid'
    );
    RAISE EXCEPTION 'invalid proof shape unexpectedly passed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_creation_receipts (
      operation_id, request_fingerprint, deployment_binding_id, generation_id,
      provider, endpoint_key, signature_key_scope, authority_key, generation
    ) VALUES (
      '10000000-0000-4000-8000-000000000009', repeat('1', 64), v_binding_id,
      v_generation_one, 'provider', 'endpoint', 'signature', 'authority', 1
    );
    RAISE EXCEPTION 'duplicate creation fingerprint unexpectedly passed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO private.payment_ingress_contract_transition_receipts (
      operation_id, request_fingerprint, provider, endpoint_key, signature_key_scope,
      authority_key, operation_kind, outgoing_generation_id,
      outgoing_expected_control_version, outgoing_result_control_version,
      outgoing_from_status, outgoing_to_status, outgoing_expected_activated_at,
      outgoing_result_activated_at, outgoing_expected_draining_at,
      outgoing_result_draining_at, outgoing_expected_retired_at,
      outgoing_result_retired_at, outgoing_expected_successor_generation_id,
      outgoing_result_successor_generation_id, actor_kind, actor_reference,
      approval_reference, evidence_reference, evidence_sha256, metrics_snapshot,
      reason_code, compatibility_basis_generation_id, compatibility_proof_id
    ) VALUES (
      '10000000-0000-4000-8000-000000000010', repeat('3', 64), 'provider',
      'endpoint', 'signature', 'authority', 'retire', v_generation_one, 1, 2,
      'active', 'retired', clock_timestamp(), clock_timestamp(), NULL,
      clock_timestamp(), NULL, clock_timestamp(), NULL, v_generation_two, 'service',
      'payment_control_plane', 'migration-fixture', repeat('c', 64), repeat('c', 64),
      '{}'::jsonb, 'retire', NULL, NULL
    );
    RAISE EXCEPTION 'invalid retire receipt branch unexpectedly passed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'private'
      AND table_name IN (
        'payment_ingress_signature_key_identities',
        'payment_ingress_deployment_manifest_bindings'
      )
      AND column_name ~* '(secret|ciphertext|credential|raw|artifact_bytes)'
  ) THEN
    RAISE EXCEPTION 'identity/binding catalog must never store secret or artifact bytes';
  END IF;
END;
$$;

-- The disposable replay actor needs temporary membership to exercise the exact
-- control-plane role gate. The enclosing transaction rolls this membership back.
GRANT payment_control_plane TO postgres;

-- Writer regression fixtures: all rows stay inside the surrounding rollback.
DO $$
DECLARE
  v_attestation_id uuid := '20000000-0000-4000-8000-000000000001';
  v_identity_id uuid := '20000000-0000-4000-8000-000000000002';
  v_binding_one uuid := '20000000-0000-4000-8000-000000000003';
  v_binding_two uuid := '20000000-0000-4000-8000-000000000004';
  v_binding_three uuid := '20000000-0000-4000-8000-000000000005';
  v_binding_four uuid := '20000000-0000-4000-8000-000000000006';
  v_binding_five uuid := '20000000-0000-4000-8000-000000000007';
  v_approver_id uuid := '20000000-0000-4000-8000-000000000008';
  v_create_one_operation uuid := '20000000-0000-4000-8000-000000000009';
  v_activate_operation uuid := '20000000-0000-4000-8000-000000000010';
  v_create_two_operation uuid := '20000000-0000-4000-8000-000000000011';
  v_roll_forward_operation uuid := '20000000-0000-4000-8000-000000000012';
  v_create_three_operation uuid := '20000000-0000-4000-8000-000000000013';
  v_rollback_operation uuid := '20000000-0000-4000-8000-000000000014';
  v_create_four_operation uuid := '20000000-0000-4000-8000-000000000015';
  v_proof_mismatch_operation uuid := '20000000-0000-4000-8000-000000000016';
  v_root_mismatch_operation uuid := '20000000-0000-4000-8000-000000000017';
  v_retire_operation uuid := '20000000-0000-4000-8000-000000000018';
  v_proof_one_id uuid := '20000000-0000-4000-8000-000000000019';
  v_proof_two_id uuid := '20000000-0000-4000-8000-000000000020';
  v_proof_mismatch_id uuid := '20000000-0000-4000-8000-000000000021';
  v_root_mismatch_proof_id uuid := '20000000-0000-4000-8000-000000000022';
  v_generation_one uuid;
  v_generation_two uuid;
  v_generation_three uuid;
  v_generation_four uuid;
  v_generation_five uuid := '20000000-0000-4000-8000-000000000023';
  v_generation bigint;
  v_control_version bigint;
  v_replayed boolean;
  v_result_code text;
BEGIN
  INSERT INTO private.payment_ingress_signature_key_identities (
    id, provider, endpoint_key, signature_key_scope, identity_revision, identity_kind,
    material_fingerprint, provenance_reference
  ) VALUES (
    v_identity_id, 'writer-provider', 'writer-endpoint', 'writer-signature', 1,
    'public_key', repeat('1', 64), 'writer-fixture'
  );

  INSERT INTO auth.users (id, email)
  VALUES (v_approver_id, 'payment-ingress-writer@example.test');

  INSERT INTO private.payment_ingress_deployment_attestations (
    id, environment, manifest_sha256, attestation_sha256, verified_by,
    approval_reference, verified_at, retention_until
  ) VALUES (
    v_attestation_id, 'writer-test', repeat('2', 64), repeat('3', 64), 'migration',
    'writer-approved', clock_timestamp(), clock_timestamp() + interval '1 day'
  );

  INSERT INTO private.payment_ingress_deployment_manifest_bindings (
    id, environment, provider, endpoint_key, signature_key_scope, authority_key,
    signature_key_identity_id, identity_revision, attestation_id,
    parser_contract_version, normalized_envelope_schema_version,
    replay_identity_contract_version, parser_artifact_sha256, manifest_sha256,
    attestation_sha256, verifier_artifact_sha256, corpus_manifest_sha256,
    normalized_envelope_equivalence_contract_version,
    replay_identity_equivalence_contract_version, provenance_reference,
    approval_reference, retention_until
  ) VALUES
    (
      v_binding_one, 'writer-test', 'writer-provider', 'writer-endpoint',
      'writer-signature', 'writer-authority', v_identity_id, 1, v_attestation_id,
      'writer-parser-v1', 'writer-envelope-v1', 'writer-replay-v1', repeat('4', 64),
      repeat('2', 64), repeat('3', 64), repeat('a', 64), repeat('b', 64),
      'writer-equivalence-envelope-v1', 'writer-equivalence-replay-v1',
      'writer-fixture', 'writer-approved', clock_timestamp() + interval '1 day'
    ),
    (
      v_binding_two, 'writer-test', 'writer-provider', 'writer-endpoint',
      'writer-signature', 'writer-authority', v_identity_id, 1, v_attestation_id,
      'writer-parser-v2', 'writer-envelope-v2', 'writer-replay-v2', repeat('5', 64),
      repeat('2', 64), repeat('3', 64), repeat('a', 64), repeat('b', 64),
      'writer-equivalence-envelope-v1', 'writer-equivalence-replay-v1',
      'writer-fixture', 'writer-approved', clock_timestamp() + interval '1 day'
    ),
    (
      v_binding_three, 'writer-test', 'writer-provider', 'writer-endpoint',
      'writer-signature', 'writer-authority', v_identity_id, 1, v_attestation_id,
      'writer-parser-v3', 'writer-envelope-v3', 'writer-replay-v3', repeat('6', 64),
      repeat('2', 64), repeat('3', 64), repeat('a', 64), repeat('b', 64),
      'writer-equivalence-envelope-v1', 'writer-equivalence-replay-v1',
      'writer-fixture', 'writer-approved', clock_timestamp() + interval '1 day'
    ),
    (
      v_binding_four, 'writer-test', 'writer-provider', 'writer-endpoint',
      'writer-signature', 'writer-authority', v_identity_id, 1, v_attestation_id,
      'writer-parser-v4', 'writer-envelope-v4', 'writer-replay-v4', repeat('7', 64),
      repeat('2', 64), repeat('3', 64), repeat('a', 64), repeat('b', 64),
      'writer-equivalence-envelope-v1', 'writer-equivalence-replay-v1',
      'writer-fixture', 'writer-approved', clock_timestamp() + interval '1 day'
    ),
    (
      v_binding_five, 'writer-test', 'writer-provider', 'writer-endpoint',
      'writer-signature', 'writer-authority', v_identity_id, 1, v_attestation_id,
      'writer-parser-v5', 'writer-envelope-v5', 'writer-replay-v5', repeat('8', 64),
      repeat('2', 64), repeat('3', 64), repeat('a', 64), repeat('b', 64),
      'writer-equivalence-envelope-v1', 'writer-equivalence-replay-v1',
      'writer-fixture', 'writer-root-mismatch', clock_timestamp() + interval '1 day'
    );

  -- The role GUC, not the function ACL, must reject every non-control caller.
  BEGIN
    PERFORM private.create_payment_ingress_contract_generation(
      v_create_one_operation, v_binding_one
    );
    RAISE EXCEPTION 'create did not reject the non-control role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM private.activate_payment_ingress_contract_generation(
      v_activate_operation, v_generation_five, 1, v_binding_one
    );
    RAISE EXCEPTION 'activate did not reject the non-control role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM private.roll_forward_payment_ingress_contract_generation(
      v_roll_forward_operation, v_generation_five, 1, v_binding_one, v_proof_one_id
    );
    RAISE EXCEPTION 'roll-forward did not reject the non-control role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM private.rollback_payment_ingress_contract_generation(
      v_rollback_operation, v_generation_five, 1, v_binding_one, v_proof_one_id
    );
    RAISE EXCEPTION 'rollback did not reject the non-control role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM private.retire_payment_ingress_contract_generation(
      v_retire_operation, v_generation_five, 1, v_binding_one
    );
    RAISE EXCEPTION 'retire did not reject the non-control role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM pg_catalog.set_config('role', 'payment_control_plane', true);
  SELECT result.generation_id, result.generation, result.control_version,
    result.replayed, result.result_code
  INTO v_generation_one, v_generation, v_control_version, v_replayed, v_result_code
  FROM private.create_payment_ingress_contract_generation(
    v_create_one_operation, v_binding_one
  ) AS result;
  IF v_generation <> 1 OR v_control_version <> 1 OR v_replayed OR v_result_code <> 'created' THEN
    RAISE EXCEPTION 'create did not produce the initial staged generation';
  END IF;

  SELECT result.generation_id, result.generation, result.control_version,
    result.replayed, result.result_code
  INTO v_generation_one, v_generation, v_control_version, v_replayed, v_result_code
  FROM private.create_payment_ingress_contract_generation(
    v_create_one_operation, v_binding_one
  ) AS result;
  IF v_generation <> 1 OR v_control_version <> 1 OR NOT v_replayed OR v_result_code <> 'replayed' THEN
    RAISE EXCEPTION 'identical creation retry was not replayed';
  END IF;

  BEGIN
    PERFORM private.create_payment_ingress_contract_generation(
      v_create_one_operation, v_binding_two
    );
    RAISE EXCEPTION 'divergent creation retry unexpectedly passed';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;

  SELECT result.generation_id, result.generation, result.control_version,
    result.replayed, result.result_code
  INTO v_generation_one, v_generation, v_control_version, v_replayed, v_result_code
  FROM private.activate_payment_ingress_contract_generation(
    v_activate_operation, v_generation_one, 1, v_binding_one
  ) AS result;
  IF v_generation <> 1 OR v_control_version <> 2 OR v_replayed OR v_result_code <> 'activated' THEN
    RAISE EXCEPTION 'initial activation did not advance the control version';
  END IF;
  PERFORM pg_catalog.set_config('role', 'none', true);

  PERFORM pg_catalog.set_config('role', 'payment_control_plane', true);
  SELECT result.generation_id, result.generation, result.control_version,
    result.replayed, result.result_code
  INTO v_generation_two, v_generation, v_control_version, v_replayed, v_result_code
  FROM private.create_payment_ingress_contract_generation(
    v_create_two_operation, v_binding_two
  ) AS result;
  IF v_generation <> 2 OR v_control_version <> 1 OR v_replayed OR v_result_code <> 'created' THEN
    RAISE EXCEPTION 'second staged generation was not created';
  END IF;
  PERFORM pg_catalog.set_config('role', 'none', true);

  INSERT INTO private.payment_ingress_parser_compatibility_proofs (
    id, provider, endpoint_key, signature_key_scope, authority_key,
    basis_generation_id, candidate_generation_id, basis_parser_artifact_sha256,
    candidate_parser_artifact_sha256,
    normalized_envelope_equivalence_contract_version,
    replay_identity_equivalence_contract_version, verifier_artifact_sha256,
    corpus_manifest_sha256, proof_sha256, result, approved_by, approval_reference
  ) VALUES (
    v_proof_one_id, 'writer-provider', 'writer-endpoint', 'writer-signature',
    'writer-authority', v_generation_one, v_generation_two, repeat('4', 64),
    repeat('5', 64), 'writer-equivalence-envelope-v1',
    'writer-equivalence-replay-v1', repeat('a', 64), repeat('b', 64),
    repeat('c', 64), 'compatible', v_approver_id, 'writer-approved'
  );

  PERFORM pg_catalog.set_config('role', 'payment_control_plane', true);
  BEGIN
    PERFORM private.roll_forward_payment_ingress_contract_generation(
      v_roll_forward_operation, v_generation_one, 1, v_binding_two, v_proof_one_id
    );
    RAISE EXCEPTION 'stale roll-forward compare-and-set unexpectedly passed';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  SELECT result.generation_id, result.generation, result.control_version,
    result.replayed, result.result_code
  INTO v_generation_two, v_generation, v_control_version, v_replayed, v_result_code
  FROM private.roll_forward_payment_ingress_contract_generation(
    v_roll_forward_operation, v_generation_one, 2, v_binding_two, v_proof_one_id
  ) AS result;
  IF v_generation <> 2 OR v_control_version <> 2 OR v_replayed
    OR v_result_code <> 'rolled_forward'
  THEN RAISE EXCEPTION 'roll-forward did not atomically advance the staged successor'; END IF;
  PERFORM pg_catalog.set_config('role', 'none', true);

  PERFORM pg_catalog.set_config('role', 'payment_control_plane', true);
  SELECT result.generation_id, result.generation, result.control_version,
    result.replayed, result.result_code
  INTO v_generation_three, v_generation, v_control_version, v_replayed, v_result_code
  FROM private.create_payment_ingress_contract_generation(
    v_create_three_operation, v_binding_three
  ) AS result;
  IF v_generation <> 3 OR v_control_version <> 1 OR v_replayed OR v_result_code <> 'created' THEN
    RAISE EXCEPTION 'third staged generation was not created';
  END IF;
  PERFORM pg_catalog.set_config('role', 'none', true);

  INSERT INTO private.payment_ingress_parser_compatibility_proofs (
    id, provider, endpoint_key, signature_key_scope, authority_key,
    basis_generation_id, candidate_generation_id, basis_parser_artifact_sha256,
    candidate_parser_artifact_sha256,
    normalized_envelope_equivalence_contract_version,
    replay_identity_equivalence_contract_version, verifier_artifact_sha256,
    corpus_manifest_sha256, proof_sha256, result, approved_by, approval_reference
  ) VALUES (
    v_proof_two_id, 'writer-provider', 'writer-endpoint', 'writer-signature',
    'writer-authority', v_generation_two, v_generation_three, repeat('5', 64),
    repeat('6', 64), 'writer-equivalence-envelope-v1',
    'writer-equivalence-replay-v1', repeat('a', 64), repeat('b', 64),
    repeat('d', 64), 'compatible', v_approver_id, 'writer-approved'
  );

  PERFORM pg_catalog.set_config('role', 'payment_control_plane', true);
  SELECT result.generation_id, result.generation, result.control_version,
    result.replayed, result.result_code
  INTO v_generation_three, v_generation, v_control_version, v_replayed, v_result_code
  FROM private.rollback_payment_ingress_contract_generation(
    v_rollback_operation, v_generation_two, 2, v_binding_three, v_proof_two_id
  ) AS result;
  IF v_generation <> 3 OR v_control_version <> 2 OR v_replayed
    OR v_result_code <> 'rolled_back'
  THEN RAISE EXCEPTION 'rollback did not atomically advance the staged successor'; END IF;
  PERFORM pg_catalog.set_config('role', 'none', true);

  PERFORM pg_catalog.set_config('role', 'payment_control_plane', true);
  SELECT result.generation_id, result.generation, result.control_version,
    result.replayed, result.result_code
  INTO v_generation_four, v_generation, v_control_version, v_replayed, v_result_code
  FROM private.create_payment_ingress_contract_generation(
    v_create_four_operation, v_binding_four
  ) AS result;
  IF v_generation <> 4 OR v_control_version <> 1 OR v_replayed OR v_result_code <> 'created' THEN
    RAISE EXCEPTION 'fourth staged generation was not created';
  END IF;
  PERFORM pg_catalog.set_config('role', 'none', true);

  INSERT INTO private.payment_ingress_parser_compatibility_proofs (
    id, provider, endpoint_key, signature_key_scope, authority_key,
    basis_generation_id, candidate_generation_id, basis_parser_artifact_sha256,
    candidate_parser_artifact_sha256,
    normalized_envelope_equivalence_contract_version,
    replay_identity_equivalence_contract_version, verifier_artifact_sha256,
    corpus_manifest_sha256, proof_sha256, result, approved_by, approval_reference
  ) VALUES (
    v_proof_mismatch_id, 'writer-provider', 'writer-endpoint', 'writer-signature',
    'writer-authority', v_generation_three, v_generation_four, repeat('6', 64),
    repeat('7', 64), 'writer-equivalence-envelope-v1',
    'writer-equivalence-replay-v1', repeat('a', 64), repeat('b', 64),
    repeat('e', 64), 'compatible', v_approver_id, 'writer-approved'
  );
  UPDATE private.payment_ingress_parser_compatibility_proofs
  SET approval_reference = 'writer-tampered'
  WHERE id = v_proof_mismatch_id;

  PERFORM pg_catalog.set_config('role', 'payment_control_plane', true);
  BEGIN
    PERFORM private.roll_forward_payment_ingress_contract_generation(
      v_proof_mismatch_operation, v_generation_three, 2, v_binding_four,
      v_proof_mismatch_id
    );
    RAISE EXCEPTION 'proof approval mismatch unexpectedly passed';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  PERFORM pg_catalog.set_config('role', 'none', true);

  INSERT INTO private.payment_ingress_contract_generations (
    id, provider, endpoint_key, signature_key_scope, signature_key_identity_id,
    authority_key, generation, parser_contract_version, parser_artifact_sha256,
    normalized_envelope_schema_version, replay_identity_contract_version
  ) VALUES (
    v_generation_five, 'writer-provider', 'writer-endpoint', 'writer-signature',
    v_identity_id, 'writer-authority', 5, 'writer-parser-v5', repeat('8', 64),
    'writer-envelope-v5', 'writer-replay-v5'
  );
  INSERT INTO private.payment_ingress_parser_compatibility_proofs (
    id, provider, endpoint_key, signature_key_scope, authority_key,
    basis_generation_id, candidate_generation_id, basis_parser_artifact_sha256,
    candidate_parser_artifact_sha256,
    normalized_envelope_equivalence_contract_version,
    replay_identity_equivalence_contract_version, verifier_artifact_sha256,
    corpus_manifest_sha256, proof_sha256, result, approved_by, approval_reference
  ) VALUES (
    v_root_mismatch_proof_id, 'writer-provider', 'writer-endpoint', 'writer-signature',
    'writer-authority', v_generation_three, v_generation_five, repeat('6', 64),
    repeat('8', 64), 'writer-equivalence-envelope-v1',
    'writer-equivalence-replay-v1', repeat('a', 64), repeat('b', 64),
    repeat('f', 64), 'compatible', v_approver_id, 'writer-root-mismatch'
  );

  PERFORM pg_catalog.set_config('role', 'payment_control_plane', true);
  BEGIN
    PERFORM private.roll_forward_payment_ingress_contract_generation(
      v_root_mismatch_operation, v_generation_three, 2, v_binding_five,
      v_root_mismatch_proof_id
    );
    RAISE EXCEPTION 'binding/root approval mismatch unexpectedly passed';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM private.retire_payment_ingress_contract_generation(
      v_retire_operation, v_generation_three, 2, v_binding_three
    );
    RAISE EXCEPTION 'retire unexpectedly passed before later safety gates';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  PERFORM pg_catalog.set_config('role', 'none', true);

  IF (SELECT count(*) FROM private.payment_ingress_contract_creation_receipts
      WHERE provider = 'writer-provider') <> 4
    OR (SELECT count(*) FROM private.payment_ingress_contract_transition_receipts
      WHERE provider = 'writer-provider') <> 3
    OR (SELECT status FROM private.payment_ingress_contract_generations
      WHERE id = v_generation_three) <> 'active'
  THEN
    RAISE EXCEPTION 'writer fixtures did not leave the expected durable control-plane evidence';
  END IF;
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_catalog.set_config('role', 'none', true);
  RAISE;
END;
$$;

ROLLBACK;
