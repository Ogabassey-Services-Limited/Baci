CREATE TABLE private.payment_ingress_contract_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  endpoint_key text NOT NULL,
  signature_key_scope text NOT NULL,
  signature_key_identity_id uuid NOT NULL,
  authority_key text NOT NULL,
  generation bigint NOT NULL,
  parser_contract_version text NOT NULL,
  parser_artifact_sha256 text NOT NULL,
  normalized_envelope_schema_version text NOT NULL,
  replay_identity_contract_version text NOT NULL,
  status text NOT NULL DEFAULT 'staged',
  control_version bigint NOT NULL DEFAULT 1,
  activated_at timestamptz,
  draining_at timestamptz,
  retired_at timestamptz,
  successor_generation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_ingress_contract_generations_provider_check
    CHECK (provider ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_ingress_contract_generations_endpoint_key_check
    CHECK (endpoint_key ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_ingress_contract_generations_signature_scope_check
    CHECK (signature_key_scope ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_ingress_contract_generations_authority_key_check
    CHECK (authority_key ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_ingress_contract_generations_generation_check
    CHECK (generation > 0),
  CONSTRAINT payment_ingress_contract_generations_control_version_check
    CHECK (control_version > 0),
  CONSTRAINT payment_ingress_contract_generations_parser_contract_check
    CHECK (
      parser_contract_version = btrim(parser_contract_version)
      AND parser_contract_version <> ''
      AND char_length(parser_contract_version) <= 255
    ),
  CONSTRAINT payment_ingress_contract_generations_parser_artifact_check
    CHECK (parser_artifact_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT payment_ingress_contract_generations_envelope_schema_check
    CHECK (
      normalized_envelope_schema_version = btrim(normalized_envelope_schema_version)
      AND normalized_envelope_schema_version <> ''
      AND char_length(normalized_envelope_schema_version) <= 255
    ),
  CONSTRAINT payment_ingress_contract_generations_replay_identity_check
    CHECK (
      replay_identity_contract_version = btrim(replay_identity_contract_version)
      AND replay_identity_contract_version <> ''
      AND char_length(replay_identity_contract_version) <= 255
    ),
  CONSTRAINT payment_ingress_contract_generations_status_check
    CHECK (status IN ('staged', 'active', 'draining', 'retired')),
  CONSTRAINT payment_ingress_contract_generations_lifecycle_check
    CHECK (
      (status = 'staged'
        AND activated_at IS NULL
        AND draining_at IS NULL
        AND retired_at IS NULL
        AND successor_generation_id IS NULL)
      OR (status = 'active'
        AND activated_at IS NOT NULL
        AND draining_at IS NULL
        AND retired_at IS NULL
        AND successor_generation_id IS NULL)
      OR (status = 'draining'
        AND activated_at IS NOT NULL
        AND draining_at IS NOT NULL
        AND retired_at IS NULL
        AND successor_generation_id IS NOT NULL)
      OR (status = 'retired'
        AND activated_at IS NOT NULL
        AND draining_at IS NOT NULL
        AND retired_at IS NOT NULL
        AND successor_generation_id IS NOT NULL)
    ),
  CONSTRAINT payment_ingress_contract_generations_timestamps_check
    CHECK (
      (draining_at IS NULL OR draining_at >= activated_at)
      AND (retired_at IS NULL OR retired_at >= draining_at)
    ),
  CONSTRAINT payment_ingress_contract_generations_successor_not_self_check
    CHECK (
      successor_generation_id IS NULL
      OR successor_generation_id <> id
    ),
  CONSTRAINT payment_ingress_contract_generations_scope_generation_key
    UNIQUE (provider, endpoint_key, signature_key_scope, authority_key, generation),
  CONSTRAINT payment_ingress_contract_generations_identity_scope_key
    UNIQUE (id, provider, endpoint_key, signature_key_scope, authority_key),
  CONSTRAINT payment_ingress_contract_generations_identity_artifact_scope_uq
    UNIQUE (
      id,
      provider,
      endpoint_key,
      signature_key_scope,
      authority_key,
      parser_artifact_sha256
    ),
  CONSTRAINT payment_ingress_contract_generations_successor_fkey
    FOREIGN KEY (
      successor_generation_id,
      provider,
      endpoint_key,
      signature_key_scope,
      authority_key
    ) REFERENCES private.payment_ingress_contract_generations (
      id,
      provider,
      endpoint_key,
      signature_key_scope,
      authority_key
    ) DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX payment_ingress_contract_generations_successor_uidx
  ON private.payment_ingress_contract_generations (successor_generation_id)
  WHERE successor_generation_id IS NOT NULL;

CREATE UNIQUE INDEX payment_ingress_contract_generations_one_active_uidx
  ON private.payment_ingress_contract_generations (
    provider,
    endpoint_key,
    signature_key_scope,
    authority_key
  )
  WHERE status = 'active';

CREATE INDEX payment_ingress_contract_generations_scope_status_idx
  ON private.payment_ingress_contract_generations (
    provider,
    endpoint_key,
    signature_key_scope,
    authority_key,
    status,
    generation DESC
  );

ALTER TABLE private.payment_ingress_contract_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.payment_ingress_contract_generations FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.payment_ingress_contract_generations FROM PUBLIC;
REVOKE ALL ON TABLE private.payment_ingress_contract_generations FROM anon;
REVOKE ALL ON TABLE private.payment_ingress_contract_generations FROM authenticated;
REVOKE ALL ON TABLE private.payment_ingress_contract_generations FROM service_role;

COMMENT ON TABLE private.payment_ingress_contract_generations IS 'Pre-tenant, endpoint-scoped, non-financial ingress contract registry; contains no secrets and grants no completion authority.';
COMMENT ON COLUMN private.payment_ingress_contract_generations.signature_key_identity_id IS 'Opaque non-secret identity; deliberately unbound until the reviewed identity catalog and guarded creator land.';
COMMENT ON COLUMN private.payment_ingress_contract_generations.authority_key IS 'Classifier only, never a completion-authority grant.';
COMMENT ON COLUMN private.payment_ingress_contract_generations.successor_generation_id IS 'Forward-only, same-scope successor; no writer exists in this slice.';
