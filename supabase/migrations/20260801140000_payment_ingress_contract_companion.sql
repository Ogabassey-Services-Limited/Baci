-- Dormant private control plane for payment-ingress contract generations.
-- This migration is deliberately unreachable by runtime/payment-provider paths.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  v_role_oid oid;
  v_can_login boolean;
  v_is_superuser boolean;
  v_can_create_db boolean;
  v_can_create_role boolean;
  v_inherit boolean;
  v_replication boolean;
  v_bypass_rls boolean;
BEGIN
  SELECT role_row.oid, role_row.rolcanlogin, role_row.rolsuper,
    role_row.rolcreatedb, role_row.rolcreaterole, role_row.rolinherit,
    role_row.rolreplication, role_row.rolbypassrls
  INTO v_role_oid, v_can_login, v_is_superuser, v_can_create_db,
    v_can_create_role, v_inherit, v_replication, v_bypass_rls
  FROM pg_catalog.pg_roles AS role_row
  WHERE role_row.rolname = 'payment_control_plane';

  IF NOT FOUND THEN
    CREATE ROLE payment_control_plane
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION
      NOBYPASSRLS;
  ELSIF v_can_login OR v_is_superuser OR v_can_create_db OR v_can_create_role
    OR v_inherit OR v_replication OR v_bypass_rls
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_auth_members AS membership
      WHERE membership.roleid = v_role_oid
        OR membership.member = v_role_oid
    )
  THEN
    RAISE EXCEPTION
      'payment_control_plane must be an unprivileged role with no memberships'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE TABLE private.payment_ingress_signature_key_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  endpoint_key text NOT NULL,
  signature_key_scope text NOT NULL,
  identity_revision bigint NOT NULL,
  identity_kind text NOT NULL,
  material_fingerprint text NOT NULL,
  provenance_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_ingress_signature_key_identities_provider_check
    CHECK (provider ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_ingress_signature_key_identities_endpoint_key_check
    CHECK (endpoint_key ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_ingress_signature_key_identities_signature_scope_check
    CHECK (signature_key_scope ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_ingress_signature_key_identities_revision_check
    CHECK (identity_revision > 0),
  CONSTRAINT payment_ingress_signature_key_identities_kind_check
    CHECK (identity_kind IN ('public_key', 'shared_secret_config')),
  CONSTRAINT payment_ingress_signature_key_identities_fingerprint_check
    CHECK (material_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT payment_ingress_signature_key_identities_provenance_check
    CHECK (
      provenance_reference = btrim(provenance_reference)
      AND provenance_reference <> ''
      AND char_length(provenance_reference) <= 512
    ),
  CONSTRAINT payment_ingress_signature_key_identities_scope_revision_key
    UNIQUE (provider, endpoint_key, signature_key_scope, identity_revision),
  CONSTRAINT payment_ingress_signature_key_identities_identity_scope_key
    UNIQUE (id, provider, endpoint_key, signature_key_scope),
  CONSTRAINT payment_ingress_key_identities_identity_revision_scope_uq
    UNIQUE (id, provider, endpoint_key, signature_key_scope, identity_revision)
);

CREATE TABLE private.payment_ingress_deployment_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL,
  manifest_sha256 text NOT NULL,
  attestation_sha256 text NOT NULL,
  verified_by text NOT NULL,
  approval_reference text NOT NULL,
  verified_at timestamptz NOT NULL,
  retention_until timestamptz NOT NULL,
  revoked_at timestamptz,
  revocation_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_ingress_deployment_attestations_environment_check
    CHECK (environment ~ '^[a-z][a-z0-9_.:-]{0,63}$'),
  CONSTRAINT payment_ingress_deployment_attestations_manifest_hash_check
    CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT payment_ingress_deployment_attestations_attestation_hash_check
    CHECK (attestation_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT payment_ingress_deployment_attestations_verified_by_check
    CHECK (
      verified_by = btrim(verified_by)
      AND verified_by <> ''
      AND char_length(verified_by) <= 255
    ),
  CONSTRAINT payment_ingress_attestations_approval_reference_ck
    CHECK (
      approval_reference = btrim(approval_reference)
      AND approval_reference <> ''
      AND char_length(approval_reference) <= 512
    ),
  CONSTRAINT payment_ingress_deployment_attestations_revocation_pair_check
    CHECK (
      (revoked_at IS NULL AND revocation_reference IS NULL)
      OR (
        revoked_at IS NOT NULL
        AND revocation_reference = btrim(revocation_reference)
        AND revocation_reference <> ''
        AND char_length(revocation_reference) <= 512
      )
    ),
  CONSTRAINT payment_ingress_deployment_attestations_identity_key
    UNIQUE (id, environment, manifest_sha256, attestation_sha256)
);

CREATE OR REPLACE FUNCTION private.payment_ingress_deployment_attestations_write_once()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.revoked_at IS NULL
    AND OLD.revocation_reference IS NULL
    AND NEW.revoked_at IS NOT NULL
    AND NEW.revocation_reference IS NOT NULL
    AND NEW.id = OLD.id
    AND NEW.environment = OLD.environment
    AND NEW.manifest_sha256 = OLD.manifest_sha256
    AND NEW.attestation_sha256 = OLD.attestation_sha256
    AND NEW.verified_by = OLD.verified_by
    AND NEW.approval_reference = OLD.approval_reference
    AND NEW.verified_at = OLD.verified_at
    AND NEW.retention_until = OLD.retention_until
    AND NEW.created_at = OLD.created_at
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'payment ingress deployment attestation revocation is write-once'
    USING ERRCODE = '55000';
END;
$$;

ALTER FUNCTION private.payment_ingress_deployment_attestations_write_once()
  OWNER TO postgres;

CREATE TRIGGER payment_ingress_deployment_attestations_write_once_trigger
  BEFORE UPDATE ON private.payment_ingress_deployment_attestations
  FOR EACH ROW
  EXECUTE FUNCTION private.payment_ingress_deployment_attestations_write_once();

CREATE TABLE private.payment_ingress_deployment_manifest_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL,
  provider text NOT NULL,
  endpoint_key text NOT NULL,
  signature_key_scope text NOT NULL,
  authority_key text NOT NULL,
  signature_key_identity_id uuid NOT NULL,
  identity_revision bigint NOT NULL,
  attestation_id uuid NOT NULL,
  parser_contract_version text NOT NULL,
  normalized_envelope_schema_version text NOT NULL,
  replay_identity_contract_version text NOT NULL,
  parser_artifact_sha256 text NOT NULL,
  manifest_sha256 text NOT NULL,
  attestation_sha256 text NOT NULL,
  verifier_artifact_sha256 text NOT NULL,
  corpus_manifest_sha256 text NOT NULL,
  normalized_envelope_equivalence_contract_version text NOT NULL,
  replay_identity_equivalence_contract_version text NOT NULL,
  provenance_reference text NOT NULL,
  approval_reference text NOT NULL,
  retention_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_ingress_deployment_manifest_bindings_environment_check
    CHECK (environment ~ '^[a-z][a-z0-9_.:-]{0,63}$'),
  CONSTRAINT payment_ingress_deployment_manifest_bindings_provider_check
    CHECK (provider ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_ingress_deployment_manifest_bindings_endpoint_key_check
    CHECK (endpoint_key ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_ingress_bindings_signature_scope_ck
    CHECK (signature_key_scope ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_ingress_bindings_authority_key_ck
    CHECK (authority_key ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_ingress_deployment_manifest_bindings_revision_check
    CHECK (identity_revision > 0),
  CONSTRAINT payment_ingress_deployment_manifest_bindings_versions_check
    CHECK (
      parser_contract_version = btrim(parser_contract_version)
      AND parser_contract_version <> ''
      AND char_length(parser_contract_version) <= 255
      AND normalized_envelope_schema_version = btrim(normalized_envelope_schema_version)
      AND normalized_envelope_schema_version <> ''
      AND char_length(normalized_envelope_schema_version) <= 255
      AND replay_identity_contract_version = btrim(replay_identity_contract_version)
      AND replay_identity_contract_version <> ''
      AND char_length(replay_identity_contract_version) <= 255
      AND normalized_envelope_equivalence_contract_version = btrim(normalized_envelope_equivalence_contract_version)
      AND normalized_envelope_equivalence_contract_version <> ''
      AND char_length(normalized_envelope_equivalence_contract_version) <= 255
      AND replay_identity_equivalence_contract_version = btrim(replay_identity_equivalence_contract_version)
      AND replay_identity_equivalence_contract_version <> ''
      AND char_length(replay_identity_equivalence_contract_version) <= 255
    ),
  CONSTRAINT payment_ingress_deployment_manifest_bindings_hashes_check
    CHECK (
      parser_artifact_sha256 ~ '^[0-9a-f]{64}$'
      AND manifest_sha256 ~ '^[0-9a-f]{64}$'
      AND attestation_sha256 ~ '^[0-9a-f]{64}$'
      AND verifier_artifact_sha256 ~ '^[0-9a-f]{64}$'
      AND corpus_manifest_sha256 ~ '^[0-9a-f]{64}$'
    ),
  CONSTRAINT payment_ingress_deployment_manifest_bindings_references_check
    CHECK (
      provenance_reference = btrim(provenance_reference)
      AND provenance_reference <> ''
      AND char_length(provenance_reference) <= 512
      AND approval_reference = btrim(approval_reference)
      AND approval_reference <> ''
      AND char_length(approval_reference) <= 512
    ),
  CONSTRAINT payment_ingress_bindings_identity_revision_fk
    FOREIGN KEY (
      signature_key_identity_id, provider, endpoint_key, signature_key_scope,
      identity_revision
    ) REFERENCES private.payment_ingress_signature_key_identities (
      id, provider, endpoint_key, signature_key_scope, identity_revision
    ) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_ingress_deployment_manifest_bindings_attestation_fkey
    FOREIGN KEY (attestation_id, environment, manifest_sha256, attestation_sha256)
    REFERENCES private.payment_ingress_deployment_attestations (
      id, environment, manifest_sha256, attestation_sha256
    ) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_ingress_deployment_manifest_bindings_unique_binding
    UNIQUE (
      environment, manifest_sha256, attestation_sha256, provider, endpoint_key,
      signature_key_scope, authority_key, parser_artifact_sha256
    ),
  CONSTRAINT payment_ingress_deployment_manifest_bindings_scope_key
    UNIQUE (id, provider, endpoint_key, signature_key_scope, authority_key)
);

ALTER TABLE private.payment_ingress_contract_generations
  ADD CONSTRAINT payment_ingress_contract_generations_identity_catalog_fkey
  FOREIGN KEY (
    signature_key_identity_id, provider, endpoint_key, signature_key_scope
  ) REFERENCES private.payment_ingress_signature_key_identities (
    id, provider, endpoint_key, signature_key_scope
  ) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE private.payment_ingress_contract_generations
  ADD CONSTRAINT payment_ingress_generations_identity_scope_generation_uq
  UNIQUE (
    id, provider, endpoint_key, signature_key_scope, authority_key, generation
  );

CREATE TABLE private.payment_ingress_parser_compatibility_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  endpoint_key text NOT NULL,
  signature_key_scope text NOT NULL,
  authority_key text NOT NULL,
  basis_generation_id uuid NOT NULL,
  candidate_generation_id uuid NOT NULL,
  basis_parser_artifact_sha256 text NOT NULL,
  candidate_parser_artifact_sha256 text NOT NULL,
  normalized_envelope_equivalence_contract_version text NOT NULL,
  replay_identity_equivalence_contract_version text NOT NULL,
  verifier_artifact_sha256 text NOT NULL,
  corpus_manifest_sha256 text NOT NULL,
  proof_sha256 text NOT NULL,
  result text NOT NULL,
  approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approval_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_ingress_parser_compatibility_proofs_provider_check
    CHECK (provider ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_ingress_parser_compatibility_proofs_endpoint_key_check
    CHECK (endpoint_key ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_ingress_proofs_signature_scope_ck
    CHECK (signature_key_scope ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_ingress_parser_compatibility_proofs_authority_key_check
    CHECK (authority_key ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_ingress_proofs_generation_pair_ck
    CHECK (basis_generation_id <> candidate_generation_id),
  CONSTRAINT payment_ingress_parser_compatibility_proofs_versions_check
    CHECK (
      normalized_envelope_equivalence_contract_version = btrim(normalized_envelope_equivalence_contract_version)
      AND normalized_envelope_equivalence_contract_version <> ''
      AND char_length(normalized_envelope_equivalence_contract_version) <= 255
      AND replay_identity_equivalence_contract_version = btrim(replay_identity_equivalence_contract_version)
      AND replay_identity_equivalence_contract_version <> ''
      AND char_length(replay_identity_equivalence_contract_version) <= 255
    ),
  CONSTRAINT payment_ingress_parser_compatibility_proofs_hashes_check
    CHECK (
      basis_parser_artifact_sha256 ~ '^[0-9a-f]{64}$'
      AND candidate_parser_artifact_sha256 ~ '^[0-9a-f]{64}$'
      AND verifier_artifact_sha256 ~ '^[0-9a-f]{64}$'
      AND corpus_manifest_sha256 ~ '^[0-9a-f]{64}$'
      AND proof_sha256 ~ '^[0-9a-f]{64}$'
    ),
  CONSTRAINT payment_ingress_parser_compatibility_proofs_result_check
    CHECK (result = 'compatible'),
  CONSTRAINT payment_ingress_proofs_approval_reference_ck
    CHECK (
      approval_reference = btrim(approval_reference)
      AND approval_reference <> ''
      AND char_length(approval_reference) <= 512
    ),
  CONSTRAINT payment_ingress_parser_compatibility_proofs_basis_artifact_fkey
    FOREIGN KEY (
      basis_generation_id, provider, endpoint_key, signature_key_scope,
      authority_key, basis_parser_artifact_sha256
    ) REFERENCES private.payment_ingress_contract_generations (
      id, provider, endpoint_key, signature_key_scope, authority_key,
      parser_artifact_sha256
    ) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_ingress_proofs_candidate_artifact_fk
    FOREIGN KEY (
      candidate_generation_id, provider, endpoint_key, signature_key_scope,
      authority_key, candidate_parser_artifact_sha256
    ) REFERENCES private.payment_ingress_contract_generations (
      id, provider, endpoint_key, signature_key_scope, authority_key,
      parser_artifact_sha256
    ) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_ingress_parser_compatibility_proofs_receipt_key
    UNIQUE (
      id, provider, endpoint_key, signature_key_scope, authority_key,
      basis_generation_id, candidate_generation_id
    ),
  CONSTRAINT payment_ingress_parser_compatibility_proofs_unique_identity
    UNIQUE (
      provider, endpoint_key, signature_key_scope, authority_key,
      basis_generation_id, candidate_generation_id,
      normalized_envelope_equivalence_contract_version,
      replay_identity_equivalence_contract_version, verifier_artifact_sha256,
      corpus_manifest_sha256
    )
);

CREATE OR REPLACE FUNCTION private.payment_ingress_parser_compatibility_proofs_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_basis_generation bigint;
  v_candidate_generation bigint;
BEGIN
  SELECT generation INTO v_basis_generation
  FROM private.payment_ingress_contract_generations
  WHERE id = NEW.basis_generation_id
    AND provider = NEW.provider
    AND endpoint_key = NEW.endpoint_key
    AND signature_key_scope = NEW.signature_key_scope
    AND authority_key = NEW.authority_key;

  SELECT generation INTO v_candidate_generation
  FROM private.payment_ingress_contract_generations
  WHERE id = NEW.candidate_generation_id
    AND provider = NEW.provider
    AND endpoint_key = NEW.endpoint_key
    AND signature_key_scope = NEW.signature_key_scope
    AND authority_key = NEW.authority_key;

  IF v_basis_generation IS NULL
    OR v_candidate_generation IS NULL
    OR v_basis_generation >= v_candidate_generation
  THEN
    RAISE EXCEPTION 'payment ingress proof generation pair must be ascending'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION private.payment_ingress_parser_compatibility_proofs_validate()
  OWNER TO postgres;

CREATE TRIGGER payment_ingress_parser_compatibility_proofs_validate_trigger
  BEFORE INSERT OR UPDATE ON private.payment_ingress_parser_compatibility_proofs
  FOR EACH ROW
  EXECUTE FUNCTION private.payment_ingress_parser_compatibility_proofs_validate();

CREATE TABLE private.payment_ingress_contract_creation_receipts (
  operation_id uuid PRIMARY KEY,
  request_fingerprint text NOT NULL,
  deployment_binding_id uuid NOT NULL,
  generation_id uuid NOT NULL,
  provider text NOT NULL,
  endpoint_key text NOT NULL,
  signature_key_scope text NOT NULL,
  authority_key text NOT NULL,
  generation bigint NOT NULL,
  result_control_version bigint NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_ingress_contract_creation_receipts_fingerprint_check
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT payment_ingress_contract_creation_receipts_generation_check
    CHECK (generation > 0),
  CONSTRAINT payment_ingress_contract_creation_receipts_result_version_check
    CHECK (result_control_version > 0),
  CONSTRAINT payment_ingress_contract_creation_receipts_fingerprint_key
    UNIQUE (request_fingerprint),
  CONSTRAINT payment_ingress_contract_creation_receipts_binding_scope_fkey
    FOREIGN KEY (
      deployment_binding_id, provider, endpoint_key, signature_key_scope,
      authority_key
    ) REFERENCES private.payment_ingress_deployment_manifest_bindings (
      id, provider, endpoint_key, signature_key_scope, authority_key
    ) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_ingress_creation_receipts_generation_identity_fk
    FOREIGN KEY (
      generation_id, provider, endpoint_key, signature_key_scope, authority_key,
      generation
    ) REFERENCES private.payment_ingress_contract_generations (
      id, provider, endpoint_key, signature_key_scope, authority_key, generation
    ) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE private.payment_ingress_contract_transition_receipts (
  operation_id uuid PRIMARY KEY,
  request_fingerprint text NOT NULL,
  provider text NOT NULL,
  endpoint_key text NOT NULL,
  signature_key_scope text NOT NULL,
  authority_key text NOT NULL,
  operation_kind text NOT NULL,
  outgoing_generation_id uuid,
  outgoing_expected_control_version bigint,
  outgoing_result_control_version bigint,
  outgoing_from_status text,
  outgoing_to_status text,
  outgoing_expected_activated_at timestamptz,
  outgoing_result_activated_at timestamptz,
  outgoing_expected_draining_at timestamptz,
  outgoing_result_draining_at timestamptz,
  outgoing_expected_retired_at timestamptz,
  outgoing_result_retired_at timestamptz,
  outgoing_expected_successor_generation_id uuid,
  outgoing_result_successor_generation_id uuid,
  incoming_generation_id uuid,
  incoming_expected_control_version bigint,
  incoming_result_control_version bigint,
  incoming_from_status text,
  incoming_to_status text,
  incoming_expected_activated_at timestamptz,
  incoming_result_activated_at timestamptz,
  incoming_expected_draining_at timestamptz,
  incoming_result_draining_at timestamptz,
  incoming_expected_retired_at timestamptz,
  incoming_result_retired_at timestamptz,
  incoming_expected_successor_generation_id uuid,
  incoming_result_successor_generation_id uuid,
  deployment_binding_id uuid,
  actor_kind text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  actor_reference text NOT NULL,
  approval_reference text NOT NULL,
  evidence_reference text NOT NULL,
  evidence_sha256 text NOT NULL,
  metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason_code text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  compatibility_basis_generation_id uuid,
  compatibility_proof_id uuid,
  CONSTRAINT payment_ingress_contract_transition_receipts_fingerprint_check
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT payment_ingress_transition_receipts_operation_kind_ck
    CHECK (operation_kind IN ('initial_activate', 'roll_forward', 'rollback', 'retire')),
  CONSTRAINT payment_ingress_contract_transition_receipts_actor_check
    CHECK (
      actor_kind IN ('operator', 'service', 'migration')
      AND ((actor_kind = 'operator') = (actor_user_id IS NOT NULL))
    ),
  CONSTRAINT payment_ingress_transition_receipts_actor_reference_ck
    CHECK (
      actor_reference = btrim(actor_reference)
      AND actor_reference <> ''
      AND char_length(actor_reference) <= 512
      AND approval_reference = btrim(approval_reference)
      AND approval_reference <> ''
      AND char_length(approval_reference) <= 512
      AND evidence_reference = btrim(evidence_reference)
      AND evidence_reference <> ''
      AND char_length(evidence_reference) <= 512
    ),
  CONSTRAINT payment_ingress_transition_receipts_evidence_hash_ck
    CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT payment_ingress_contract_transition_receipts_metrics_check
    CHECK (jsonb_typeof(metrics_snapshot) = 'object'),
  CONSTRAINT payment_ingress_contract_transition_receipts_reason_check
    CHECK (reason_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT payment_ingress_transition_receipts_distinct_rows_ck
    CHECK (
      outgoing_generation_id IS NULL
      OR incoming_generation_id IS NULL
      OR outgoing_generation_id <> incoming_generation_id
    ),
  CONSTRAINT payment_ingress_transition_receipts_branch_matrix_ck
    CHECK (
      (
        (
        operation_kind = 'initial_activate'
        AND outgoing_generation_id IS NULL
        AND outgoing_expected_control_version IS NULL
        AND outgoing_result_control_version IS NULL
        AND outgoing_from_status IS NULL
        AND outgoing_to_status IS NULL
        AND outgoing_expected_activated_at IS NULL
        AND outgoing_result_activated_at IS NULL
        AND outgoing_expected_draining_at IS NULL
        AND outgoing_result_draining_at IS NULL
        AND outgoing_expected_retired_at IS NULL
        AND outgoing_result_retired_at IS NULL
        AND outgoing_expected_successor_generation_id IS NULL
        AND outgoing_result_successor_generation_id IS NULL
        AND incoming_generation_id IS NOT NULL
        AND incoming_expected_control_version > 0
        AND incoming_result_control_version = incoming_expected_control_version + 1
        AND incoming_from_status = 'staged'
        AND incoming_to_status = 'active'
        AND incoming_expected_activated_at IS NULL
        AND incoming_result_activated_at = recorded_at
        AND incoming_expected_draining_at IS NULL
        AND incoming_result_draining_at IS NULL
        AND incoming_expected_retired_at IS NULL
        AND incoming_result_retired_at IS NULL
        AND incoming_expected_successor_generation_id IS NULL
        AND incoming_result_successor_generation_id IS NULL
        AND deployment_binding_id IS NOT NULL
        AND compatibility_basis_generation_id IS NULL
        AND compatibility_proof_id IS NULL
      )
      OR (
        operation_kind IN ('roll_forward', 'rollback')
        AND outgoing_generation_id IS NOT NULL
        AND outgoing_expected_control_version > 0
        AND outgoing_result_control_version = outgoing_expected_control_version + 1
        AND outgoing_from_status = 'active'
        AND outgoing_to_status = 'draining'
        AND outgoing_expected_activated_at IS NOT NULL
        AND outgoing_result_activated_at = outgoing_expected_activated_at
        AND outgoing_expected_draining_at IS NULL
        AND outgoing_result_draining_at = recorded_at
        AND outgoing_expected_retired_at IS NULL
        AND outgoing_result_retired_at IS NULL
        AND outgoing_expected_successor_generation_id IS NULL
        AND outgoing_result_successor_generation_id = incoming_generation_id
        AND incoming_generation_id IS NOT NULL
        AND incoming_expected_control_version > 0
        AND incoming_result_control_version = incoming_expected_control_version + 1
        AND incoming_from_status = 'staged'
        AND incoming_to_status = 'active'
        AND incoming_expected_activated_at IS NULL
        AND incoming_result_activated_at = recorded_at
        AND incoming_expected_draining_at IS NULL
        AND incoming_result_draining_at IS NULL
        AND incoming_expected_retired_at IS NULL
        AND incoming_result_retired_at IS NULL
        AND incoming_expected_successor_generation_id IS NULL
        AND incoming_result_successor_generation_id IS NULL
        AND deployment_binding_id IS NOT NULL
        AND compatibility_basis_generation_id = outgoing_generation_id
        AND compatibility_proof_id IS NOT NULL
      )
      OR (
        operation_kind = 'retire'
        AND outgoing_generation_id IS NOT NULL
        AND outgoing_expected_control_version > 0
        AND outgoing_result_control_version = outgoing_expected_control_version + 1
        AND outgoing_from_status = 'draining'
        AND outgoing_to_status = 'retired'
        AND outgoing_expected_activated_at IS NOT NULL
        AND outgoing_result_activated_at = outgoing_expected_activated_at
        AND outgoing_expected_draining_at IS NOT NULL
        AND outgoing_result_draining_at = outgoing_expected_draining_at
        AND outgoing_expected_retired_at IS NULL
        AND outgoing_result_retired_at = recorded_at
        AND outgoing_expected_successor_generation_id IS NOT NULL
        AND outgoing_result_successor_generation_id = outgoing_expected_successor_generation_id
        AND incoming_generation_id IS NULL
        AND incoming_expected_control_version IS NULL
        AND incoming_result_control_version IS NULL
        AND incoming_from_status IS NULL
        AND incoming_to_status IS NULL
        AND incoming_expected_activated_at IS NULL
        AND incoming_result_activated_at IS NULL
        AND incoming_expected_draining_at IS NULL
        AND incoming_result_draining_at IS NULL
        AND incoming_expected_retired_at IS NULL
        AND incoming_result_retired_at IS NULL
        AND incoming_expected_successor_generation_id IS NULL
        AND incoming_result_successor_generation_id IS NULL
        AND deployment_binding_id IS NULL
        AND compatibility_basis_generation_id IS NULL
        AND compatibility_proof_id IS NULL
        )
      ) IS TRUE
    ),
  CONSTRAINT payment_ingress_transition_receipts_outgoing_scope_fk
    FOREIGN KEY (
      outgoing_generation_id, provider, endpoint_key, signature_key_scope,
      authority_key
    ) REFERENCES private.payment_ingress_contract_generations (
      id, provider, endpoint_key, signature_key_scope, authority_key
    ) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_ingress_transition_receipts_incoming_scope_fk
    FOREIGN KEY (
      incoming_generation_id, provider, endpoint_key, signature_key_scope,
      authority_key
    ) REFERENCES private.payment_ingress_contract_generations (
      id, provider, endpoint_key, signature_key_scope, authority_key
    ) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_ingress_transition_receipts_out_expected_successor_fk
    FOREIGN KEY (
      outgoing_expected_successor_generation_id, provider, endpoint_key,
      signature_key_scope, authority_key
    ) REFERENCES private.payment_ingress_contract_generations (
      id, provider, endpoint_key, signature_key_scope, authority_key
    ) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_ingress_transition_receipts_out_result_successor_fk
    FOREIGN KEY (
      outgoing_result_successor_generation_id, provider, endpoint_key,
      signature_key_scope, authority_key
    ) REFERENCES private.payment_ingress_contract_generations (
      id, provider, endpoint_key, signature_key_scope, authority_key
    ) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_ingress_transition_receipts_in_expected_successor_fk
    FOREIGN KEY (
      incoming_expected_successor_generation_id, provider, endpoint_key,
      signature_key_scope, authority_key
    ) REFERENCES private.payment_ingress_contract_generations (
      id, provider, endpoint_key, signature_key_scope, authority_key
    ) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_ingress_transition_receipts_in_result_successor_fk
    FOREIGN KEY (
      incoming_result_successor_generation_id, provider, endpoint_key,
      signature_key_scope, authority_key
    ) REFERENCES private.payment_ingress_contract_generations (
      id, provider, endpoint_key, signature_key_scope, authority_key
    ) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_ingress_contract_transition_receipts_binding_scope_fkey
    FOREIGN KEY (
      deployment_binding_id, provider, endpoint_key, signature_key_scope,
      authority_key
    ) REFERENCES private.payment_ingress_deployment_manifest_bindings (
      id, provider, endpoint_key, signature_key_scope, authority_key
    ) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_ingress_contract_transition_receipts_basis_scope_fkey
    FOREIGN KEY (
      compatibility_basis_generation_id, provider, endpoint_key,
      signature_key_scope, authority_key
    ) REFERENCES private.payment_ingress_contract_generations (
      id, provider, endpoint_key, signature_key_scope, authority_key
    ) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_ingress_contract_transition_receipts_proof_fkey
    FOREIGN KEY (
      compatibility_proof_id, provider, endpoint_key, signature_key_scope,
      authority_key, compatibility_basis_generation_id, incoming_generation_id
    ) REFERENCES private.payment_ingress_parser_compatibility_proofs (
      id, provider, endpoint_key, signature_key_scope, authority_key,
      basis_generation_id, candidate_generation_id
    ) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX payment_ingress_bindings_identity_fk_idx
  ON private.payment_ingress_deployment_manifest_bindings (
    signature_key_identity_id, provider, endpoint_key, signature_key_scope,
    identity_revision
  );

CREATE INDEX payment_ingress_bindings_attestation_fk_idx
  ON private.payment_ingress_deployment_manifest_bindings (
    attestation_id, environment, manifest_sha256, attestation_sha256
  );

CREATE INDEX payment_ingress_generations_identity_fk_idx
  ON private.payment_ingress_contract_generations (
    signature_key_identity_id, provider, endpoint_key, signature_key_scope
  );

CREATE INDEX payment_ingress_proofs_approved_by_idx
  ON private.payment_ingress_parser_compatibility_proofs (approved_by);

CREATE INDEX payment_ingress_proofs_basis_fk_idx
  ON private.payment_ingress_parser_compatibility_proofs (
    basis_generation_id, provider, endpoint_key, signature_key_scope,
    authority_key, basis_parser_artifact_sha256
  );

CREATE INDEX payment_ingress_proofs_candidate_fk_idx
  ON private.payment_ingress_parser_compatibility_proofs (
    candidate_generation_id, provider, endpoint_key, signature_key_scope,
    authority_key, candidate_parser_artifact_sha256
  );

CREATE INDEX payment_ingress_creation_binding_fk_idx
  ON private.payment_ingress_contract_creation_receipts (
    deployment_binding_id, provider, endpoint_key, signature_key_scope,
    authority_key
  );

CREATE INDEX payment_ingress_creation_generation_fk_idx
  ON private.payment_ingress_contract_creation_receipts (
    generation_id, provider, endpoint_key, signature_key_scope, authority_key,
    generation
  );

CREATE INDEX payment_ingress_transition_actor_idx
  ON private.payment_ingress_contract_transition_receipts (actor_user_id);

CREATE INDEX payment_ingress_transition_outgoing_fk_idx
  ON private.payment_ingress_contract_transition_receipts (
    outgoing_generation_id, provider, endpoint_key, signature_key_scope,
    authority_key
  );

CREATE INDEX payment_ingress_transition_incoming_fk_idx
  ON private.payment_ingress_contract_transition_receipts (
    incoming_generation_id, provider, endpoint_key, signature_key_scope,
    authority_key
  );

CREATE INDEX payment_ingress_transition_out_expected_fk_idx
  ON private.payment_ingress_contract_transition_receipts (
    outgoing_expected_successor_generation_id, provider, endpoint_key,
    signature_key_scope, authority_key
  );

CREATE INDEX payment_ingress_transition_out_result_fk_idx
  ON private.payment_ingress_contract_transition_receipts (
    outgoing_result_successor_generation_id, provider, endpoint_key,
    signature_key_scope, authority_key
  );

CREATE INDEX payment_ingress_transition_in_expected_fk_idx
  ON private.payment_ingress_contract_transition_receipts (
    incoming_expected_successor_generation_id, provider, endpoint_key,
    signature_key_scope, authority_key
  );

CREATE INDEX payment_ingress_transition_in_result_fk_idx
  ON private.payment_ingress_contract_transition_receipts (
    incoming_result_successor_generation_id, provider, endpoint_key,
    signature_key_scope, authority_key
  );

CREATE INDEX payment_ingress_transition_binding_fk_idx
  ON private.payment_ingress_contract_transition_receipts (
    deployment_binding_id, provider, endpoint_key, signature_key_scope,
    authority_key
  );

CREATE INDEX payment_ingress_transition_basis_fk_idx
  ON private.payment_ingress_contract_transition_receipts (
    compatibility_basis_generation_id, provider, endpoint_key,
    signature_key_scope, authority_key
  );

CREATE INDEX payment_ingress_transition_proof_fk_idx
  ON private.payment_ingress_contract_transition_receipts (
    compatibility_proof_id, provider, endpoint_key, signature_key_scope,
    authority_key, compatibility_basis_generation_id, incoming_generation_id
  );

CREATE UNIQUE INDEX payment_ingress_transition_receipts_outgoing_claim_uidx
  ON private.payment_ingress_contract_transition_receipts (
    outgoing_generation_id, outgoing_expected_control_version
  ) WHERE outgoing_generation_id IS NOT NULL;

CREATE UNIQUE INDEX payment_ingress_transition_receipts_incoming_claim_uidx
  ON private.payment_ingress_contract_transition_receipts (
    incoming_generation_id, incoming_expected_control_version
  ) WHERE incoming_generation_id IS NOT NULL;

CREATE INDEX payment_ingress_contract_transition_receipts_scope_recorded_idx
  ON private.payment_ingress_contract_transition_receipts (
    provider, endpoint_key, signature_key_scope, authority_key, recorded_at DESC
  );

CREATE OR REPLACE FUNCTION private.create_payment_ingress_contract_generation(
  p_operation_id uuid,
  p_deployment_binding_id uuid
)
RETURNS TABLE (
  operation_id uuid,
  generation_id uuid,
  generation bigint,
  control_version bigint,
  replayed boolean,
  result_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_binding record;
  v_receipt record;
  v_generation record;
  v_fingerprint text;
  v_next_generation bigint;
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'payment_control_plane' THEN
    RAISE EXCEPTION 'payment ingress control-plane role is required' USING ERRCODE = '42501';
  END IF;
  IF p_operation_id IS NULL OR p_deployment_binding_id IS NULL THEN
    RAISE EXCEPTION 'operation id and deployment binding are required' USING ERRCODE = '22023';
  END IF;

  v_fingerprint := pg_catalog.encode(
    extensions.digest('create:' || p_operation_id::text || ':' || p_deployment_binding_id::text, 'sha256'),
    'hex'
  );

  -- Serialize operation identities globally before discovering a scope. This
  -- prevents the same operation_id from racing across different scopes and
  -- leaving an unreceipted generation behind after a unique-key conflict.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'payment-ingress-operation:' || p_operation_id::text, 0
  ));

  -- Discover scope without a row lock, then serialize all retries for that scope.
  SELECT binding.provider, binding.endpoint_key, binding.signature_key_scope,
    binding.authority_key
  INTO v_binding
  FROM private.payment_ingress_deployment_manifest_bindings AS binding
  WHERE binding.id = p_deployment_binding_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'deployment binding scope is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'payment-ingress:' || v_binding.provider || ':' || v_binding.endpoint_key || ':' ||
      v_binding.signature_key_scope || ':' || v_binding.authority_key,
      0
    )
  );

  SELECT receipt.operation_id, receipt.request_fingerprint, receipt.generation_id,
    receipt.result_control_version
  INTO v_receipt
  FROM private.payment_ingress_contract_creation_receipts AS receipt
  WHERE receipt.operation_id = p_operation_id;
  IF FOUND THEN
    IF v_receipt.request_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'payment ingress creation replay diverged' USING ERRCODE = 'PT409';
    END IF;
    SELECT generation_row.id, generation_row.generation, generation_row.control_version
    INTO v_generation
    FROM private.payment_ingress_contract_generations AS generation_row
    WHERE id = v_receipt.generation_id;
    RETURN QUERY SELECT v_receipt.operation_id, v_generation.id, v_generation.generation,
      v_receipt.result_control_version, true, 'replayed'::text;
    RETURN;
  END IF;

  SELECT binding.id, binding.provider, binding.endpoint_key,
    binding.signature_key_scope, binding.signature_key_identity_id,
    binding.authority_key, binding.parser_contract_version,
    binding.parser_artifact_sha256, binding.normalized_envelope_schema_version,
    binding.replay_identity_contract_version
  INTO v_binding
  FROM private.payment_ingress_deployment_manifest_bindings AS binding
  JOIN private.payment_ingress_deployment_attestations AS attestation
    ON attestation.id = binding.attestation_id
    AND attestation.environment = binding.environment
    AND attestation.manifest_sha256 = binding.manifest_sha256
    AND attestation.attestation_sha256 = binding.attestation_sha256
  WHERE binding.id = p_deployment_binding_id
    AND binding.approval_reference = attestation.approval_reference
    AND attestation.revoked_at IS NULL
    AND attestation.retention_until > pg_catalog.clock_timestamp()
    AND binding.retention_until > pg_catalog.clock_timestamp()
  FOR UPDATE OF binding, attestation;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active retained deployment binding is required' USING ERRCODE = '22023';
  END IF;

  SELECT generation_row.generation INTO v_next_generation
  FROM private.payment_ingress_contract_generations AS generation_row
  WHERE generation_row.provider = v_binding.provider
    AND generation_row.endpoint_key = v_binding.endpoint_key
    AND generation_row.signature_key_scope = v_binding.signature_key_scope
    AND generation_row.authority_key = v_binding.authority_key
  ORDER BY generation_row.generation DESC
  LIMIT 1
  FOR UPDATE;

  IF v_next_generation = 9223372036854775807 THEN
    RAISE EXCEPTION 'payment ingress generation allocation overflow' USING ERRCODE = '22003';
  END IF;
  v_next_generation := COALESCE(v_next_generation, 0) + 1;

  INSERT INTO private.payment_ingress_contract_generations AS generation_row (
    provider, endpoint_key, signature_key_scope, signature_key_identity_id,
    authority_key, generation, parser_contract_version, parser_artifact_sha256,
    normalized_envelope_schema_version, replay_identity_contract_version
  ) VALUES (
    v_binding.provider, v_binding.endpoint_key, v_binding.signature_key_scope,
    v_binding.signature_key_identity_id, v_binding.authority_key, v_next_generation,
    v_binding.parser_contract_version, v_binding.parser_artifact_sha256,
    v_binding.normalized_envelope_schema_version,
    v_binding.replay_identity_contract_version
  ) RETURNING generation_row.id, generation_row.generation,
    generation_row.control_version INTO v_generation;

  BEGIN
    INSERT INTO private.payment_ingress_contract_creation_receipts (
      operation_id, request_fingerprint, deployment_binding_id, generation_id,
      provider, endpoint_key, signature_key_scope, authority_key, generation,
      result_control_version
    ) VALUES (
      p_operation_id, v_fingerprint, v_binding.id, v_generation.id,
      v_binding.provider, v_binding.endpoint_key, v_binding.signature_key_scope,
      v_binding.authority_key, v_generation.generation, v_generation.control_version
    );
  EXCEPTION WHEN unique_violation THEN
    SELECT receipt.operation_id, receipt.request_fingerprint,
      receipt.generation_id, receipt.result_control_version
    INTO v_receipt
    FROM private.payment_ingress_contract_creation_receipts AS receipt
    WHERE receipt.operation_id = p_operation_id;
    IF NOT FOUND THEN
      RAISE;
    END IF;
    IF v_receipt.request_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'payment ingress creation replay diverged' USING ERRCODE = 'PT409';
    END IF;
    SELECT generation_row.id, generation_row.generation
    INTO v_generation
    FROM private.payment_ingress_contract_generations AS generation_row
    WHERE generation_row.id = v_receipt.generation_id;
    RETURN QUERY SELECT v_receipt.operation_id, v_generation.id, v_generation.generation,
      v_receipt.result_control_version, true, 'replayed'::text;
    RETURN;
  END;

  RETURN QUERY SELECT p_operation_id, v_generation.id, v_generation.generation,
    v_generation.control_version, false, 'created'::text;
END;
$$;

CREATE OR REPLACE FUNCTION private.activate_payment_ingress_contract_generation(
  p_operation_id uuid,
  p_generation_id uuid,
  p_expected_control_version bigint,
  p_deployment_binding_id uuid
)
RETURNS TABLE (
  operation_id uuid,
  generation_id uuid,
  generation bigint,
  control_version bigint,
  replayed boolean,
  result_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_generation record;
  v_receipt record;
  v_binding record;
  v_attestation record;
  v_fingerprint text;
  v_now timestamptz;
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'payment_control_plane' THEN
    RAISE EXCEPTION 'payment ingress control-plane role is required' USING ERRCODE = '42501';
  END IF;
  IF p_operation_id IS NULL OR p_generation_id IS NULL
    OR p_expected_control_version IS NULL OR p_deployment_binding_id IS NULL
  THEN RAISE EXCEPTION 'activation inputs are required' USING ERRCODE = '22023'; END IF;

  v_fingerprint := pg_catalog.encode(extensions.digest(
    'initial_activate:' || p_operation_id::text || ':' || p_generation_id::text || ':' ||
    p_expected_control_version::text || ':' || p_deployment_binding_id::text,
    'sha256'
  ), 'hex');

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'payment-ingress-operation:' || p_operation_id::text, 0
  ));

  -- Discover scope without holding a generation row lock before serialization.
  SELECT generation_row.provider, generation_row.endpoint_key,
    generation_row.signature_key_scope, generation_row.authority_key
  INTO v_generation
  FROM private.payment_ingress_contract_generations AS generation_row
  WHERE generation_row.id = p_generation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'staged generation compare-and-set failed' USING ERRCODE = 'PT409';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'payment-ingress:' || v_generation.provider || ':' || v_generation.endpoint_key || ':' ||
    v_generation.signature_key_scope || ':' || v_generation.authority_key, 0
  ));

  SELECT receipt.operation_id, receipt.request_fingerprint,
    receipt.incoming_generation_id, receipt.incoming_result_control_version
  INTO v_receipt
  FROM private.payment_ingress_contract_transition_receipts AS receipt
  WHERE receipt.operation_id = p_operation_id;
  IF FOUND THEN
    IF v_receipt.request_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'payment ingress activation replay diverged' USING ERRCODE = 'PT409';
    END IF;
    SELECT generation_row.id, generation_row.generation, generation_row.control_version
    INTO v_generation FROM private.payment_ingress_contract_generations AS generation_row
    WHERE id = v_receipt.incoming_generation_id;
    RETURN QUERY SELECT v_receipt.operation_id, v_generation.id, v_generation.generation,
      v_receipt.incoming_result_control_version, true, 'replayed'::text;
    RETURN;
  END IF;

  SELECT generation_row.id, generation_row.provider, generation_row.endpoint_key,
    generation_row.signature_key_scope, generation_row.signature_key_identity_id,
    generation_row.authority_key, generation_row.generation,
    generation_row.parser_contract_version, generation_row.parser_artifact_sha256,
    generation_row.normalized_envelope_schema_version,
    generation_row.replay_identity_contract_version, generation_row.status,
    generation_row.control_version
  INTO v_generation
  FROM private.payment_ingress_contract_generations AS generation_row
  WHERE generation_row.id = p_generation_id
  FOR UPDATE;
  IF NOT FOUND OR v_generation.status <> 'staged'
    OR v_generation.control_version <> p_expected_control_version
  THEN RAISE EXCEPTION 'staged generation compare-and-set failed' USING ERRCODE = 'PT409'; END IF;

  IF EXISTS (
    SELECT 1 FROM private.payment_ingress_contract_generations
    WHERE provider = v_generation.provider AND endpoint_key = v_generation.endpoint_key
      AND signature_key_scope = v_generation.signature_key_scope
      AND authority_key = v_generation.authority_key AND status = 'retired'
  ) OR EXISTS (
    SELECT 1 FROM private.payment_ingress_contract_generations
    WHERE provider = v_generation.provider AND endpoint_key = v_generation.endpoint_key
      AND signature_key_scope = v_generation.signature_key_scope
      AND authority_key = v_generation.authority_key AND status = 'active'
  ) THEN RAISE EXCEPTION 'payment ingress scope cannot be activated' USING ERRCODE = 'PT409'; END IF;

  SELECT binding.id, binding.attestation_id, binding.approval_reference
  INTO v_binding
  FROM private.payment_ingress_deployment_manifest_bindings AS binding
  JOIN private.payment_ingress_deployment_attestations AS attestation
    ON attestation.id = binding.attestation_id
    AND attestation.environment = binding.environment
    AND attestation.manifest_sha256 = binding.manifest_sha256
    AND attestation.attestation_sha256 = binding.attestation_sha256
  WHERE binding.id = p_deployment_binding_id
    AND binding.approval_reference = attestation.approval_reference
    AND binding.provider = v_generation.provider
    AND binding.endpoint_key = v_generation.endpoint_key
    AND binding.signature_key_scope = v_generation.signature_key_scope
    AND binding.authority_key = v_generation.authority_key
    AND binding.signature_key_identity_id = v_generation.signature_key_identity_id
    AND binding.parser_contract_version = v_generation.parser_contract_version
    AND binding.normalized_envelope_schema_version = v_generation.normalized_envelope_schema_version
    AND binding.replay_identity_contract_version = v_generation.replay_identity_contract_version
    AND binding.parser_artifact_sha256 = v_generation.parser_artifact_sha256
    AND attestation.revoked_at IS NULL
    AND attestation.retention_until > pg_catalog.clock_timestamp()
    AND binding.retention_until > pg_catalog.clock_timestamp()
  FOR UPDATE OF binding, attestation;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM private.payment_ingress_contract_creation_receipts AS receipt
    WHERE receipt.generation_id = v_generation.id
      AND receipt.deployment_binding_id = p_deployment_binding_id
  ) THEN RAISE EXCEPTION 'active retained creation binding is required' USING ERRCODE = '22023'; END IF;
  SELECT attestation.attestation_sha256
  INTO v_attestation
  FROM private.payment_ingress_deployment_attestations AS attestation
  WHERE id = v_binding.attestation_id;

  v_now := pg_catalog.clock_timestamp();
  UPDATE private.payment_ingress_contract_generations AS generation_row
  SET status = 'active', activated_at = v_now,
    control_version = generation_row.control_version + 1
  WHERE id = v_generation.id
  RETURNING generation_row.id, generation_row.provider, generation_row.endpoint_key,
    generation_row.signature_key_scope, generation_row.authority_key,
    generation_row.generation, generation_row.control_version INTO v_generation;

  BEGIN
    INSERT INTO private.payment_ingress_contract_transition_receipts (
      operation_id, request_fingerprint, provider, endpoint_key, signature_key_scope,
      authority_key, operation_kind, incoming_generation_id,
      incoming_expected_control_version, incoming_result_control_version,
      incoming_from_status, incoming_to_status, incoming_result_activated_at,
      deployment_binding_id, actor_kind, actor_reference, approval_reference,
      evidence_reference, evidence_sha256, metrics_snapshot, reason_code, recorded_at
    ) VALUES (
      p_operation_id, v_fingerprint, v_generation.provider, v_generation.endpoint_key,
      v_generation.signature_key_scope, v_generation.authority_key, 'initial_activate',
      v_generation.id, p_expected_control_version, v_generation.control_version,
      'staged', 'active', v_now, v_binding.id, 'service', 'payment_control_plane',
      v_binding.approval_reference, v_attestation.attestation_sha256,
      v_attestation.attestation_sha256, '{}'::jsonb, 'initial_activate', v_now
    );
  EXCEPTION WHEN unique_violation THEN
    SELECT receipt.operation_id, receipt.request_fingerprint,
      receipt.incoming_generation_id, receipt.incoming_result_control_version
    INTO v_receipt
    FROM private.payment_ingress_contract_transition_receipts AS receipt
    WHERE receipt.operation_id = p_operation_id;
    IF NOT FOUND THEN
      RAISE;
    END IF;
    IF v_receipt.request_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'payment ingress activation replay diverged' USING ERRCODE = 'PT409';
    END IF;
    SELECT generation_row.id, generation_row.generation
    INTO v_generation
    FROM private.payment_ingress_contract_generations AS generation_row
    WHERE generation_row.id = v_receipt.incoming_generation_id;
    RETURN QUERY SELECT v_receipt.operation_id, v_generation.id, v_generation.generation,
      v_receipt.incoming_result_control_version, true, 'replayed'::text;
    RETURN;
  END;
  RETURN QUERY SELECT p_operation_id, v_generation.id, v_generation.generation,
    v_generation.control_version, false, 'activated'::text;
END;
$$;

CREATE OR REPLACE FUNCTION private.roll_forward_payment_ingress_contract_generation(
  p_operation_id uuid,
  p_outgoing_generation_id uuid,
  p_expected_control_version bigint,
  p_deployment_binding_id uuid,
  p_compatibility_proof_id uuid
)
RETURNS TABLE (
  operation_id uuid,
  generation_id uuid,
  generation bigint,
  control_version bigint,
  replayed boolean,
  result_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_outgoing record;
  v_incoming record;
  v_proof record;
  v_receipt record;
  v_binding record;
  v_attestation record;
  v_fingerprint text;
  v_now timestamptz;
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'payment_control_plane' THEN
    RAISE EXCEPTION 'payment ingress control-plane role is required' USING ERRCODE = '42501';
  END IF;
  IF p_operation_id IS NULL OR p_outgoing_generation_id IS NULL
    OR p_expected_control_version IS NULL OR p_deployment_binding_id IS NULL
    OR p_compatibility_proof_id IS NULL
  THEN RAISE EXCEPTION 'roll-forward inputs are required' USING ERRCODE = '22023'; END IF;

  v_fingerprint := pg_catalog.encode(extensions.digest(
    'roll_forward:' || p_operation_id::text || ':' || p_outgoing_generation_id::text || ':' ||
    p_expected_control_version::text || ':' || p_deployment_binding_id::text || ':' ||
    p_compatibility_proof_id::text, 'sha256'
  ), 'hex');

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'payment-ingress-operation:' || p_operation_id::text, 0
  ));

  -- Read only the immutable scope identity before taking the scope lock.
  SELECT generation_row.provider, generation_row.endpoint_key,
    generation_row.signature_key_scope, generation_row.authority_key
  INTO v_outgoing
  FROM private.payment_ingress_contract_generations AS generation_row
  WHERE generation_row.id = p_outgoing_generation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'active outgoing generation compare-and-set failed' USING ERRCODE = 'PT409';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'payment-ingress:' || v_outgoing.provider || ':' || v_outgoing.endpoint_key || ':' ||
    v_outgoing.signature_key_scope || ':' || v_outgoing.authority_key, 0
  ));

  SELECT receipt.operation_id, receipt.request_fingerprint,
    receipt.incoming_generation_id, receipt.incoming_result_control_version
  INTO v_receipt
  FROM private.payment_ingress_contract_transition_receipts AS receipt
  WHERE receipt.operation_id = p_operation_id;
  IF FOUND THEN
    IF v_receipt.request_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'payment ingress roll-forward replay diverged' USING ERRCODE = 'PT409';
    END IF;
    SELECT generation_row.id, generation_row.generation, generation_row.control_version
    INTO v_incoming FROM private.payment_ingress_contract_generations AS generation_row
    WHERE generation_row.id = v_receipt.incoming_generation_id;
    RETURN QUERY SELECT v_receipt.operation_id, v_incoming.id, v_incoming.generation,
      v_receipt.incoming_result_control_version, true, 'replayed'::text;
    RETURN;
  END IF;

  SELECT generation_row.id, generation_row.provider, generation_row.endpoint_key,
    generation_row.signature_key_scope, generation_row.authority_key,
    generation_row.generation, generation_row.parser_artifact_sha256,
    generation_row.status, generation_row.control_version, generation_row.activated_at
  INTO v_outgoing
  FROM private.payment_ingress_contract_generations AS generation_row
  WHERE generation_row.id = p_outgoing_generation_id
  FOR UPDATE;
  IF NOT FOUND OR v_outgoing.status <> 'active'
    OR v_outgoing.control_version <> p_expected_control_version
  THEN RAISE EXCEPTION 'active outgoing generation compare-and-set failed' USING ERRCODE = 'PT409'; END IF;

  SELECT proof.id, proof.candidate_generation_id,
    proof.candidate_parser_artifact_sha256, proof.verifier_artifact_sha256,
    proof.corpus_manifest_sha256,
    proof.normalized_envelope_equivalence_contract_version,
    proof.replay_identity_equivalence_contract_version, proof.approval_reference
  INTO v_proof FROM private.payment_ingress_parser_compatibility_proofs AS proof
  WHERE proof.id = p_compatibility_proof_id
    AND provider = v_outgoing.provider
    AND endpoint_key = v_outgoing.endpoint_key
    AND signature_key_scope = v_outgoing.signature_key_scope
    AND authority_key = v_outgoing.authority_key
    AND basis_generation_id = v_outgoing.id
    AND basis_parser_artifact_sha256 = v_outgoing.parser_artifact_sha256
    AND result = 'compatible'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'approved compatibility proof is required' USING ERRCODE = '22023'; END IF;

  SELECT generation_row.id, generation_row.provider, generation_row.endpoint_key,
    generation_row.signature_key_scope, generation_row.signature_key_identity_id,
    generation_row.authority_key, generation_row.generation,
    generation_row.parser_contract_version, generation_row.parser_artifact_sha256,
    generation_row.normalized_envelope_schema_version,
    generation_row.replay_identity_contract_version, generation_row.status,
    generation_row.control_version
  INTO v_incoming FROM private.payment_ingress_contract_generations AS generation_row
  WHERE generation_row.id = v_proof.candidate_generation_id
  FOR UPDATE;
  IF NOT FOUND OR v_incoming.status <> 'staged'
    OR v_incoming.generation <= v_outgoing.generation
    OR v_incoming.provider <> v_outgoing.provider
    OR v_incoming.endpoint_key <> v_outgoing.endpoint_key
    OR v_incoming.signature_key_scope <> v_outgoing.signature_key_scope
    OR v_incoming.authority_key <> v_outgoing.authority_key
    OR v_incoming.parser_artifact_sha256 <> v_proof.candidate_parser_artifact_sha256
  THEN RAISE EXCEPTION 'roll-forward successor is invalid' USING ERRCODE = 'PT409'; END IF;

  SELECT binding.id, binding.attestation_id, binding.approval_reference
  INTO v_binding
  FROM private.payment_ingress_deployment_manifest_bindings AS binding
  JOIN private.payment_ingress_deployment_attestations AS attestation
    ON attestation.id = binding.attestation_id
    AND attestation.environment = binding.environment
    AND attestation.manifest_sha256 = binding.manifest_sha256
    AND attestation.attestation_sha256 = binding.attestation_sha256
  WHERE binding.id = p_deployment_binding_id
    AND v_proof.approval_reference = binding.approval_reference
    AND binding.approval_reference = attestation.approval_reference
    AND binding.provider = v_incoming.provider
    AND binding.endpoint_key = v_incoming.endpoint_key
    AND binding.signature_key_scope = v_incoming.signature_key_scope
    AND binding.authority_key = v_incoming.authority_key
    AND binding.signature_key_identity_id = v_incoming.signature_key_identity_id
    AND binding.parser_contract_version = v_incoming.parser_contract_version
    AND binding.normalized_envelope_schema_version = v_incoming.normalized_envelope_schema_version
    AND binding.replay_identity_contract_version = v_incoming.replay_identity_contract_version
    AND binding.parser_artifact_sha256 = v_incoming.parser_artifact_sha256
    AND binding.verifier_artifact_sha256 = v_proof.verifier_artifact_sha256
    AND binding.corpus_manifest_sha256 = v_proof.corpus_manifest_sha256
    AND binding.normalized_envelope_equivalence_contract_version = v_proof.normalized_envelope_equivalence_contract_version
    AND binding.replay_identity_equivalence_contract_version = v_proof.replay_identity_equivalence_contract_version
    AND attestation.revoked_at IS NULL
    AND attestation.retention_until > pg_catalog.clock_timestamp()
    AND binding.retention_until > pg_catalog.clock_timestamp()
  FOR UPDATE OF binding, attestation;
  IF NOT FOUND THEN RAISE EXCEPTION 'active retained deployment binding is required' USING ERRCODE = '22023'; END IF;
  SELECT attestation.attestation_sha256
  INTO v_attestation
  FROM private.payment_ingress_deployment_attestations AS attestation
  WHERE id = v_binding.attestation_id;

  v_now := pg_catalog.clock_timestamp();
  UPDATE private.payment_ingress_contract_generations AS outgoing_generation
  SET status = 'draining', draining_at = v_now,
    successor_generation_id = v_incoming.id,
    control_version = outgoing_generation.control_version + 1
  WHERE id = v_outgoing.id
  RETURNING outgoing_generation.id, outgoing_generation.provider,
    outgoing_generation.endpoint_key, outgoing_generation.signature_key_scope,
    outgoing_generation.authority_key, outgoing_generation.control_version,
    outgoing_generation.activated_at INTO v_outgoing;
  UPDATE private.payment_ingress_contract_generations AS incoming_generation
  SET status = 'active', activated_at = v_now,
    control_version = incoming_generation.control_version + 1
  WHERE id = v_incoming.id
  RETURNING incoming_generation.id, incoming_generation.generation,
    incoming_generation.control_version INTO v_incoming;

  BEGIN
    INSERT INTO private.payment_ingress_contract_transition_receipts (
      operation_id, request_fingerprint, provider, endpoint_key, signature_key_scope,
      authority_key, operation_kind, outgoing_generation_id,
      outgoing_expected_control_version, outgoing_result_control_version,
      outgoing_from_status, outgoing_to_status, outgoing_expected_activated_at,
      outgoing_result_activated_at, outgoing_result_draining_at,
      outgoing_result_successor_generation_id, incoming_generation_id,
      incoming_expected_control_version, incoming_result_control_version,
      incoming_from_status, incoming_to_status, incoming_result_activated_at,
      deployment_binding_id, actor_kind, actor_reference, approval_reference,
      evidence_reference, evidence_sha256, metrics_snapshot, reason_code,
      recorded_at, compatibility_basis_generation_id, compatibility_proof_id
    ) VALUES (
      p_operation_id, v_fingerprint, v_outgoing.provider, v_outgoing.endpoint_key,
      v_outgoing.signature_key_scope, v_outgoing.authority_key, 'roll_forward',
      v_outgoing.id, p_expected_control_version, v_outgoing.control_version,
      'active', 'draining', v_outgoing.activated_at, v_outgoing.activated_at, v_now,
      v_incoming.id, v_incoming.id, v_incoming.control_version - 1,
      v_incoming.control_version, 'staged', 'active', v_now, v_binding.id,
      'service', 'payment_control_plane', v_binding.approval_reference,
      v_attestation.attestation_sha256, v_attestation.attestation_sha256, '{}'::jsonb,
      'roll_forward', v_now, v_outgoing.id, v_proof.id
    );
  EXCEPTION WHEN unique_violation THEN
    SELECT receipt.operation_id, receipt.request_fingerprint,
      receipt.incoming_generation_id, receipt.incoming_result_control_version
    INTO v_receipt
    FROM private.payment_ingress_contract_transition_receipts AS receipt
    WHERE receipt.operation_id = p_operation_id;
    IF NOT FOUND THEN
      RAISE;
    END IF;
    IF v_receipt.request_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'payment ingress roll-forward replay diverged' USING ERRCODE = 'PT409';
    END IF;
    SELECT generation_row.id, generation_row.generation
    INTO v_incoming
    FROM private.payment_ingress_contract_generations AS generation_row
    WHERE generation_row.id = v_receipt.incoming_generation_id;
    RETURN QUERY SELECT v_receipt.operation_id, v_incoming.id, v_incoming.generation,
      v_receipt.incoming_result_control_version, true, 'replayed'::text;
    RETURN;
  END;
  RETURN QUERY SELECT p_operation_id, v_incoming.id, v_incoming.generation,
    v_incoming.control_version, false, 'rolled_forward'::text;
END;
$$;

CREATE OR REPLACE FUNCTION private.rollback_payment_ingress_contract_generation(
  p_operation_id uuid,
  p_outgoing_generation_id uuid,
  p_expected_control_version bigint,
  p_deployment_binding_id uuid,
  p_compatibility_proof_id uuid
)
RETURNS TABLE (
  operation_id uuid,
  generation_id uuid,
  generation bigint,
  control_version bigint,
  replayed boolean,
  result_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_outgoing record;
  v_incoming record;
  v_proof record;
  v_receipt record;
  v_binding record;
  v_attestation record;
  v_fingerprint text;
  v_now timestamptz;
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'payment_control_plane' THEN
    RAISE EXCEPTION 'payment ingress control-plane role is required' USING ERRCODE = '42501';
  END IF;
  IF p_operation_id IS NULL OR p_outgoing_generation_id IS NULL
    OR p_expected_control_version IS NULL OR p_deployment_binding_id IS NULL
    OR p_compatibility_proof_id IS NULL
  THEN RAISE EXCEPTION 'rollback inputs are required' USING ERRCODE = '22023'; END IF;

  v_fingerprint := pg_catalog.encode(extensions.digest(
    'rollback:' || p_operation_id::text || ':' || p_outgoing_generation_id::text || ':' ||
    p_expected_control_version::text || ':' || p_deployment_binding_id::text || ':' ||
    p_compatibility_proof_id::text, 'sha256'
  ), 'hex');

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'payment-ingress-operation:' || p_operation_id::text, 0
  ));

  -- Read scope first without a row lock so concurrent writers serialize together.
  SELECT generation_row.provider, generation_row.endpoint_key,
    generation_row.signature_key_scope, generation_row.authority_key
  INTO v_outgoing
  FROM private.payment_ingress_contract_generations AS generation_row
  WHERE generation_row.id = p_outgoing_generation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'active outgoing generation compare-and-set failed' USING ERRCODE = 'PT409';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'payment-ingress:' || v_outgoing.provider || ':' || v_outgoing.endpoint_key || ':' ||
    v_outgoing.signature_key_scope || ':' || v_outgoing.authority_key, 0
  ));

  SELECT receipt.operation_id, receipt.request_fingerprint,
    receipt.incoming_generation_id, receipt.incoming_result_control_version
  INTO v_receipt
  FROM private.payment_ingress_contract_transition_receipts AS receipt
  WHERE receipt.operation_id = p_operation_id;
  IF FOUND THEN
    IF v_receipt.request_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'payment ingress rollback replay diverged' USING ERRCODE = 'PT409';
    END IF;
    SELECT generation_row.id, generation_row.generation, generation_row.control_version
    INTO v_incoming FROM private.payment_ingress_contract_generations AS generation_row
    WHERE generation_row.id = v_receipt.incoming_generation_id;
    RETURN QUERY SELECT v_receipt.operation_id, v_incoming.id, v_incoming.generation,
      v_receipt.incoming_result_control_version, true, 'replayed'::text;
    RETURN;
  END IF;

  SELECT generation_row.id, generation_row.provider, generation_row.endpoint_key,
    generation_row.signature_key_scope, generation_row.authority_key,
    generation_row.generation, generation_row.parser_artifact_sha256,
    generation_row.status, generation_row.control_version, generation_row.activated_at
  INTO v_outgoing
  FROM private.payment_ingress_contract_generations AS generation_row
  WHERE generation_row.id = p_outgoing_generation_id
  FOR UPDATE;
  IF NOT FOUND OR v_outgoing.status <> 'active'
    OR v_outgoing.control_version <> p_expected_control_version
  THEN RAISE EXCEPTION 'active outgoing generation compare-and-set failed' USING ERRCODE = 'PT409'; END IF;

  SELECT proof.id, proof.candidate_generation_id,
    proof.candidate_parser_artifact_sha256, proof.verifier_artifact_sha256,
    proof.corpus_manifest_sha256,
    proof.normalized_envelope_equivalence_contract_version,
    proof.replay_identity_equivalence_contract_version, proof.approval_reference
  INTO v_proof FROM private.payment_ingress_parser_compatibility_proofs AS proof
  WHERE proof.id = p_compatibility_proof_id
    AND provider = v_outgoing.provider
    AND endpoint_key = v_outgoing.endpoint_key
    AND signature_key_scope = v_outgoing.signature_key_scope
    AND authority_key = v_outgoing.authority_key
    AND basis_generation_id = v_outgoing.id
    AND basis_parser_artifact_sha256 = v_outgoing.parser_artifact_sha256
    AND result = 'compatible'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'approved compatibility proof is required' USING ERRCODE = '22023'; END IF;

  SELECT generation_row.id, generation_row.provider, generation_row.endpoint_key,
    generation_row.signature_key_scope, generation_row.signature_key_identity_id,
    generation_row.authority_key, generation_row.generation,
    generation_row.parser_contract_version, generation_row.parser_artifact_sha256,
    generation_row.normalized_envelope_schema_version,
    generation_row.replay_identity_contract_version, generation_row.status,
    generation_row.control_version
  INTO v_incoming FROM private.payment_ingress_contract_generations AS generation_row
  WHERE generation_row.id = v_proof.candidate_generation_id
  FOR UPDATE;
  IF NOT FOUND OR v_incoming.status <> 'staged'
    OR v_incoming.generation <= v_outgoing.generation
    OR v_incoming.provider <> v_outgoing.provider
    OR v_incoming.endpoint_key <> v_outgoing.endpoint_key
    OR v_incoming.signature_key_scope <> v_outgoing.signature_key_scope
    OR v_incoming.authority_key <> v_outgoing.authority_key
    OR v_incoming.parser_artifact_sha256 <> v_proof.candidate_parser_artifact_sha256
  THEN RAISE EXCEPTION 'rollback successor is invalid' USING ERRCODE = 'PT409'; END IF;

  SELECT binding.id, binding.attestation_id, binding.approval_reference
  INTO v_binding
  FROM private.payment_ingress_deployment_manifest_bindings AS binding
  JOIN private.payment_ingress_deployment_attestations AS attestation
    ON attestation.id = binding.attestation_id
    AND attestation.environment = binding.environment
    AND attestation.manifest_sha256 = binding.manifest_sha256
    AND attestation.attestation_sha256 = binding.attestation_sha256
  WHERE binding.id = p_deployment_binding_id
    AND v_proof.approval_reference = binding.approval_reference
    AND binding.approval_reference = attestation.approval_reference
    AND binding.provider = v_incoming.provider
    AND binding.endpoint_key = v_incoming.endpoint_key
    AND binding.signature_key_scope = v_incoming.signature_key_scope
    AND binding.authority_key = v_incoming.authority_key
    AND binding.signature_key_identity_id = v_incoming.signature_key_identity_id
    AND binding.parser_contract_version = v_incoming.parser_contract_version
    AND binding.normalized_envelope_schema_version = v_incoming.normalized_envelope_schema_version
    AND binding.replay_identity_contract_version = v_incoming.replay_identity_contract_version
    AND binding.parser_artifact_sha256 = v_incoming.parser_artifact_sha256
    AND binding.verifier_artifact_sha256 = v_proof.verifier_artifact_sha256
    AND binding.corpus_manifest_sha256 = v_proof.corpus_manifest_sha256
    AND binding.normalized_envelope_equivalence_contract_version = v_proof.normalized_envelope_equivalence_contract_version
    AND binding.replay_identity_equivalence_contract_version = v_proof.replay_identity_equivalence_contract_version
    AND attestation.revoked_at IS NULL
    AND attestation.retention_until > pg_catalog.clock_timestamp()
    AND binding.retention_until > pg_catalog.clock_timestamp()
  FOR UPDATE OF binding, attestation;
  IF NOT FOUND THEN RAISE EXCEPTION 'active retained deployment binding is required' USING ERRCODE = '22023'; END IF;
  SELECT attestation.attestation_sha256
  INTO v_attestation
  FROM private.payment_ingress_deployment_attestations AS attestation
  WHERE id = v_binding.attestation_id;

  v_now := pg_catalog.clock_timestamp();
  UPDATE private.payment_ingress_contract_generations AS outgoing_generation
  SET status = 'draining', draining_at = v_now,
    successor_generation_id = v_incoming.id,
    control_version = outgoing_generation.control_version + 1
  WHERE id = v_outgoing.id
  RETURNING outgoing_generation.id, outgoing_generation.provider,
    outgoing_generation.endpoint_key, outgoing_generation.signature_key_scope,
    outgoing_generation.authority_key, outgoing_generation.control_version,
    outgoing_generation.activated_at INTO v_outgoing;
  UPDATE private.payment_ingress_contract_generations AS incoming_generation
  SET status = 'active', activated_at = v_now,
    control_version = incoming_generation.control_version + 1
  WHERE id = v_incoming.id
  RETURNING incoming_generation.id, incoming_generation.generation,
    incoming_generation.control_version INTO v_incoming;

  BEGIN
    INSERT INTO private.payment_ingress_contract_transition_receipts (
      operation_id, request_fingerprint, provider, endpoint_key, signature_key_scope,
      authority_key, operation_kind, outgoing_generation_id,
      outgoing_expected_control_version, outgoing_result_control_version,
      outgoing_from_status, outgoing_to_status, outgoing_expected_activated_at,
      outgoing_result_activated_at, outgoing_result_draining_at,
      outgoing_result_successor_generation_id, incoming_generation_id,
      incoming_expected_control_version, incoming_result_control_version,
      incoming_from_status, incoming_to_status, incoming_result_activated_at,
      deployment_binding_id, actor_kind, actor_reference, approval_reference,
      evidence_reference, evidence_sha256, metrics_snapshot, reason_code,
      recorded_at, compatibility_basis_generation_id, compatibility_proof_id
    ) VALUES (
      p_operation_id, v_fingerprint, v_outgoing.provider, v_outgoing.endpoint_key,
      v_outgoing.signature_key_scope, v_outgoing.authority_key, 'rollback',
      v_outgoing.id, p_expected_control_version, v_outgoing.control_version,
      'active', 'draining', v_outgoing.activated_at, v_outgoing.activated_at, v_now,
      v_incoming.id, v_incoming.id, v_incoming.control_version - 1,
      v_incoming.control_version, 'staged', 'active', v_now, v_binding.id,
      'service', 'payment_control_plane', v_binding.approval_reference,
      v_attestation.attestation_sha256, v_attestation.attestation_sha256, '{}'::jsonb,
      'rollback', v_now, v_outgoing.id, v_proof.id
    );
  EXCEPTION WHEN unique_violation THEN
    SELECT receipt.operation_id, receipt.request_fingerprint,
      receipt.incoming_generation_id, receipt.incoming_result_control_version
    INTO v_receipt
    FROM private.payment_ingress_contract_transition_receipts AS receipt
    WHERE receipt.operation_id = p_operation_id;
    IF NOT FOUND THEN
      RAISE;
    END IF;
    IF v_receipt.request_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'payment ingress rollback replay diverged' USING ERRCODE = 'PT409';
    END IF;
    SELECT generation_row.id, generation_row.generation
    INTO v_incoming
    FROM private.payment_ingress_contract_generations AS generation_row
    WHERE generation_row.id = v_receipt.incoming_generation_id;
    RETURN QUERY SELECT v_receipt.operation_id, v_incoming.id, v_incoming.generation,
      v_receipt.incoming_result_control_version, true, 'replayed'::text;
    RETURN;
  END;
  RETURN QUERY SELECT p_operation_id, v_incoming.id, v_incoming.generation,
    v_incoming.control_version, false, 'rolled_back'::text;
END;
$$;

CREATE OR REPLACE FUNCTION private.retire_payment_ingress_contract_generation(
  p_operation_id uuid,
  p_outgoing_generation_id uuid,
  p_expected_control_version bigint,
  p_deployment_binding_id uuid
)
RETURNS TABLE (
  operation_id uuid,
  generation_id uuid,
  generation bigint,
  control_version bigint,
  replayed boolean,
  result_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_generation record;
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'payment_control_plane' THEN
    RAISE EXCEPTION 'payment ingress control-plane role is required' USING ERRCODE = '42501';
  END IF;
  IF p_operation_id IS NULL OR p_outgoing_generation_id IS NULL
    OR p_expected_control_version IS NULL OR p_deployment_binding_id IS NULL
  THEN RAISE EXCEPTION 'retirement inputs are required' USING ERRCODE = '22023'; END IF;

  -- Retirement remains closed, but still derives and serializes a known scope
  -- without acquiring a generation row lock first.
  SELECT generation_row.provider, generation_row.endpoint_key,
    generation_row.signature_key_scope, generation_row.authority_key
  INTO v_generation
  FROM private.payment_ingress_contract_generations AS generation_row
  WHERE generation_row.id = p_outgoing_generation_id;
  IF FOUND THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'payment-ingress:' || v_generation.provider || ':' || v_generation.endpoint_key || ':' ||
      v_generation.signature_key_scope || ':' || v_generation.authority_key, 0
    ));
  END IF;

  RAISE EXCEPTION 'payment ingress retirement is unavailable before inbox, redelivery, census, and retention gates'
    USING ERRCODE = '55000';
END;
$$;

ALTER FUNCTION private.create_payment_ingress_contract_generation(uuid, uuid)
  OWNER TO postgres;
ALTER FUNCTION private.activate_payment_ingress_contract_generation(uuid, uuid, bigint, uuid)
  OWNER TO postgres;
ALTER FUNCTION private.roll_forward_payment_ingress_contract_generation(uuid, uuid, bigint, uuid, uuid)
  OWNER TO postgres;
ALTER FUNCTION private.rollback_payment_ingress_contract_generation(uuid, uuid, bigint, uuid, uuid)
  OWNER TO postgres;
ALTER FUNCTION private.retire_payment_ingress_contract_generation(uuid, uuid, bigint, uuid)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION private.payment_ingress_deployment_attestations_write_once() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.payment_ingress_parser_compatibility_proofs_validate() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.create_payment_ingress_contract_generation(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.activate_payment_ingress_contract_generation(uuid, uuid, bigint, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.roll_forward_payment_ingress_contract_generation(uuid, uuid, bigint, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.rollback_payment_ingress_contract_generation(uuid, uuid, bigint, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.retire_payment_ingress_contract_generation(uuid, uuid, bigint, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.create_payment_ingress_contract_generation(uuid, uuid) FROM anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.activate_payment_ingress_contract_generation(uuid, uuid, bigint, uuid) FROM anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.roll_forward_payment_ingress_contract_generation(uuid, uuid, bigint, uuid, uuid) FROM anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.rollback_payment_ingress_contract_generation(uuid, uuid, bigint, uuid, uuid) FROM anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.retire_payment_ingress_contract_generation(uuid, uuid, bigint, uuid) FROM anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO payment_control_plane;
GRANT EXECUTE ON FUNCTION private.create_payment_ingress_contract_generation(uuid, uuid) TO payment_control_plane;
GRANT EXECUTE ON FUNCTION private.activate_payment_ingress_contract_generation(uuid, uuid, bigint, uuid) TO payment_control_plane;
GRANT EXECUTE ON FUNCTION private.roll_forward_payment_ingress_contract_generation(uuid, uuid, bigint, uuid, uuid) TO payment_control_plane;
GRANT EXECUTE ON FUNCTION private.rollback_payment_ingress_contract_generation(uuid, uuid, bigint, uuid, uuid) TO payment_control_plane;
GRANT EXECUTE ON FUNCTION private.retire_payment_ingress_contract_generation(uuid, uuid, bigint, uuid) TO payment_control_plane;

ALTER TABLE private.payment_ingress_signature_key_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.payment_ingress_signature_key_identities FORCE ROW LEVEL SECURITY;
ALTER TABLE private.payment_ingress_deployment_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.payment_ingress_deployment_attestations FORCE ROW LEVEL SECURITY;
ALTER TABLE private.payment_ingress_deployment_manifest_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.payment_ingress_deployment_manifest_bindings FORCE ROW LEVEL SECURITY;
ALTER TABLE private.payment_ingress_parser_compatibility_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.payment_ingress_parser_compatibility_proofs FORCE ROW LEVEL SECURITY;
ALTER TABLE private.payment_ingress_contract_creation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.payment_ingress_contract_creation_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE private.payment_ingress_contract_transition_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.payment_ingress_contract_transition_receipts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.payment_ingress_signature_key_identities FROM PUBLIC;
REVOKE ALL ON TABLE private.payment_ingress_signature_key_identities FROM anon;
REVOKE ALL ON TABLE private.payment_ingress_signature_key_identities FROM authenticated;
REVOKE ALL ON TABLE private.payment_ingress_signature_key_identities FROM service_role;
REVOKE ALL ON TABLE private.payment_ingress_signature_key_identities FROM payment_control_plane;
REVOKE ALL ON TABLE private.payment_ingress_deployment_attestations FROM PUBLIC;
REVOKE ALL ON TABLE private.payment_ingress_deployment_attestations FROM anon;
REVOKE ALL ON TABLE private.payment_ingress_deployment_attestations FROM authenticated;
REVOKE ALL ON TABLE private.payment_ingress_deployment_attestations FROM service_role;
REVOKE ALL ON TABLE private.payment_ingress_deployment_attestations FROM payment_control_plane;
REVOKE ALL ON TABLE private.payment_ingress_deployment_manifest_bindings FROM PUBLIC;
REVOKE ALL ON TABLE private.payment_ingress_deployment_manifest_bindings FROM anon;
REVOKE ALL ON TABLE private.payment_ingress_deployment_manifest_bindings FROM authenticated;
REVOKE ALL ON TABLE private.payment_ingress_deployment_manifest_bindings FROM service_role;
REVOKE ALL ON TABLE private.payment_ingress_deployment_manifest_bindings FROM payment_control_plane;
REVOKE ALL ON TABLE private.payment_ingress_parser_compatibility_proofs FROM PUBLIC;
REVOKE ALL ON TABLE private.payment_ingress_parser_compatibility_proofs FROM anon;
REVOKE ALL ON TABLE private.payment_ingress_parser_compatibility_proofs FROM authenticated;
REVOKE ALL ON TABLE private.payment_ingress_parser_compatibility_proofs FROM service_role;
REVOKE ALL ON TABLE private.payment_ingress_parser_compatibility_proofs FROM payment_control_plane;
REVOKE ALL ON TABLE private.payment_ingress_contract_creation_receipts FROM PUBLIC;
REVOKE ALL ON TABLE private.payment_ingress_contract_creation_receipts FROM anon;
REVOKE ALL ON TABLE private.payment_ingress_contract_creation_receipts FROM authenticated;
REVOKE ALL ON TABLE private.payment_ingress_contract_creation_receipts FROM service_role;
REVOKE ALL ON TABLE private.payment_ingress_contract_creation_receipts FROM payment_control_plane;
REVOKE ALL ON TABLE private.payment_ingress_contract_transition_receipts FROM PUBLIC;
REVOKE ALL ON TABLE private.payment_ingress_contract_transition_receipts FROM anon;
REVOKE ALL ON TABLE private.payment_ingress_contract_transition_receipts FROM authenticated;
REVOKE ALL ON TABLE private.payment_ingress_contract_transition_receipts FROM service_role;
REVOKE ALL ON TABLE private.payment_ingress_contract_transition_receipts FROM payment_control_plane;

COMMENT ON TABLE private.payment_ingress_signature_key_identities IS 'Immutable non-secret signature-key identity catalog; no secret, ciphertext, credential, or raw-key bytes are stored.';
COMMENT ON TABLE private.payment_ingress_deployment_attestations IS 'Append-only externally attested deployment root; revocation is the single privileged write-once exception.';
COMMENT ON TABLE private.payment_ingress_deployment_manifest_bindings IS 'Append-only metadata-only deployment binding pinned to an active retained attestation.';
COMMENT ON TABLE private.payment_ingress_parser_compatibility_proofs IS 'Append-only parser compatibility proof; canonicalization authority is the pinned external verifier artifact.';
COMMENT ON TABLE private.payment_ingress_contract_creation_receipts IS 'Append-only idempotent receipt for a guarded staged ingress generation creation.';
COMMENT ON TABLE private.payment_ingress_contract_transition_receipts IS 'Append-only CAS evidence for guarded ingress-generation transitions; metrics snapshot is audit data, never authority.';
COMMENT ON FUNCTION private.create_payment_ingress_contract_generation(uuid, uuid) IS 'Dormant payment_control_plane-only guarded staged generation creator.';
COMMENT ON FUNCTION private.activate_payment_ingress_contract_generation(uuid, uuid, bigint, uuid) IS 'Dormant payment_control_plane-only guarded initial activation writer.';
COMMENT ON FUNCTION private.roll_forward_payment_ingress_contract_generation(uuid, uuid, bigint, uuid, uuid) IS 'Dormant payment_control_plane-only guarded roll-forward writer.';
COMMENT ON FUNCTION private.rollback_payment_ingress_contract_generation(uuid, uuid, bigint, uuid, uuid) IS 'Dormant payment_control_plane-only guarded rollback writer.';
COMMENT ON FUNCTION private.retire_payment_ingress_contract_generation(uuid, uuid, bigint, uuid) IS 'Dormant payment_control_plane-only retirement fence; permanently fails closed until later gates land.';
