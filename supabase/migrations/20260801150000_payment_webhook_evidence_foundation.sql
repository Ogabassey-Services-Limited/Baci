BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE private.payment_ingress_contract_generations
  ADD CONSTRAINT payment_ingress_contract_generations_evidence_binding_key
  UNIQUE (
    id,
    provider,
    endpoint_key,
    signature_key_scope,
    authority_key,
    signature_key_identity_id,
    generation,
    parser_contract_version,
    normalized_envelope_schema_version,
    replay_identity_contract_version
  );

CREATE TABLE private.payment_webhook_source_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id uuid,
  provider text NOT NULL,
  endpoint_key text NOT NULL,
  signature_key_scope text NOT NULL,
  completion_authority_key text NOT NULL,
  signature_key_identity_id uuid NOT NULL,
  ingress_contract_generation_id uuid NOT NULL,
  ingress_contract_generation bigint NOT NULL,
  adapter_schema_version text NOT NULL,
  normalized_envelope_schema_version text NOT NULL,
  replay_identity_contract_version text NOT NULL,
  replay_key_kind text NOT NULL,
  replay_key_digest text NOT NULL,
  replay_key_preimage jsonb NOT NULL,
  ingress_scope_snapshot jsonb NOT NULL,
  merchant_id uuid,
  provider_account_scope text,
  capture_mode text NOT NULL,
  child_manifest_sha256 text NOT NULL,
  child_count integer NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  contract_bound_minor bigint NOT NULL,
  redacted_parent_source_identity jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_webhook_source_manifests_provider_check
    CHECK (provider ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_webhook_source_manifests_endpoint_key_check
    CHECK (endpoint_key ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_webhook_source_manifests_signature_scope_check
    CHECK (signature_key_scope ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_webhook_source_manifests_authority_key_check
    CHECK (completion_authority_key ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_webhook_source_manifests_generation_fkey
    FOREIGN KEY (
      ingress_contract_generation_id, provider, endpoint_key, signature_key_scope,
      completion_authority_key, signature_key_identity_id, ingress_contract_generation,
      adapter_schema_version, normalized_envelope_schema_version,
      replay_identity_contract_version
    ) REFERENCES private.payment_ingress_contract_generations (
      id, provider, endpoint_key, signature_key_scope, authority_key,
      signature_key_identity_id, generation, parser_contract_version,
      normalized_envelope_schema_version, replay_identity_contract_version
    ) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_webhook_source_manifests_replay_kind_check
    CHECK (replay_key_kind IN ('svix', 'account_reference', 'fallback_locator')),
  CONSTRAINT payment_webhook_source_manifests_replay_digest_check
    CHECK (replay_key_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT payment_webhook_source_manifests_replay_preimage_check
    CHECK (
      jsonb_typeof(replay_key_preimage) = 'object'
      AND jsonb_typeof(replay_key_preimage->'v') = 'number'
      AND replay_key_preimage->>'v' = '1'
      AND replay_key_preimage->>'kind' = replay_key_kind
      AND (
        (
          replay_key_kind = 'svix'
          AND replay_key_preimage ?& ARRAY['v','kind','provider','endpoint_key','signature_key_scope','completion_authority_key','svix_id','event_type']::text[]
          AND replay_key_preimage - ARRAY['v','kind','provider','endpoint_key','signature_key_scope','completion_authority_key','svix_id','event_type']::text[] = '{}'::jsonb
          AND jsonb_typeof(replay_key_preimage->'kind') = 'string'
          AND jsonb_typeof(replay_key_preimage->'provider') = 'string'
          AND jsonb_typeof(replay_key_preimage->'endpoint_key') = 'string'
          AND jsonb_typeof(replay_key_preimage->'signature_key_scope') = 'string'
          AND jsonb_typeof(replay_key_preimage->'completion_authority_key') = 'string'
          AND jsonb_typeof(replay_key_preimage->'svix_id') = 'string'
          AND jsonb_typeof(replay_key_preimage->'event_type') = 'string'
        ) OR (
          replay_key_kind = 'account_reference'
          AND replay_key_preimage ?& ARRAY['v','kind','provider','completion_authority_key','provider_account_scope','provider_reference','event_type']::text[]
          AND replay_key_preimage - ARRAY['v','kind','provider','completion_authority_key','provider_account_scope','provider_reference','event_type']::text[] = '{}'::jsonb
          AND jsonb_typeof(replay_key_preimage->'kind') = 'string'
          AND jsonb_typeof(replay_key_preimage->'provider') = 'string'
          AND jsonb_typeof(replay_key_preimage->'completion_authority_key') = 'string'
          AND jsonb_typeof(replay_key_preimage->'provider_account_scope') = 'string'
          AND jsonb_typeof(replay_key_preimage->'provider_reference') = 'string'
          AND jsonb_typeof(replay_key_preimage->'event_type') = 'string'
        ) OR (
          replay_key_kind = 'fallback_locator'
          AND replay_key_preimage ?& ARRAY['v','kind','provider','endpoint_key','signature_key_scope','completion_authority_key','event_type','reference','amount_minor','currency','provider_paid_at','raw_body_sha256']::text[]
          AND replay_key_preimage - ARRAY['v','kind','provider','endpoint_key','signature_key_scope','completion_authority_key','event_type','reference','amount_minor','currency','provider_paid_at','raw_body_sha256']::text[] = '{}'::jsonb
          AND jsonb_typeof(replay_key_preimage->'kind') = 'string'
          AND jsonb_typeof(replay_key_preimage->'provider') = 'string'
          AND jsonb_typeof(replay_key_preimage->'endpoint_key') = 'string'
          AND jsonb_typeof(replay_key_preimage->'signature_key_scope') = 'string'
          AND jsonb_typeof(replay_key_preimage->'completion_authority_key') = 'string'
          AND jsonb_typeof(replay_key_preimage->'event_type') = 'string'
          AND jsonb_typeof(replay_key_preimage->'reference') = 'string'
          AND jsonb_typeof(replay_key_preimage->'amount_minor') = 'string'
          AND jsonb_typeof(replay_key_preimage->'currency') = 'string'
          AND jsonb_typeof(replay_key_preimage->'provider_paid_at') = 'string'
          AND jsonb_typeof(replay_key_preimage->'raw_body_sha256') = 'string'
        )
      )
    ),
  CONSTRAINT payment_webhook_source_manifests_scope_snapshot_check
    CHECK (
      jsonb_typeof(ingress_scope_snapshot) = 'object'
      AND ingress_scope_snapshot ?& ARRAY['merchant_id','provider_account_scope']::text[]
      AND ingress_scope_snapshot - ARRAY['merchant_id','provider_account_scope']::text[] = '{}'::jsonb
      AND jsonb_typeof(ingress_scope_snapshot->'merchant_id') = 'string'
      AND jsonb_typeof(ingress_scope_snapshot->'provider_account_scope') = 'string'
      AND ingress_scope_snapshot->>'merchant_id' = btrim(ingress_scope_snapshot->>'merchant_id')
      AND ingress_scope_snapshot->>'merchant_id' <> ''
      AND ingress_scope_snapshot->>'provider_account_scope' = btrim(ingress_scope_snapshot->>'provider_account_scope')
      AND ingress_scope_snapshot->>'provider_account_scope' <> ''
    ),
  CONSTRAINT payment_webhook_source_manifests_economics_check
    CHECK (
      (provider_account_scope IS NULL OR (
        provider_account_scope = btrim(provider_account_scope)
        AND provider_account_scope <> ''
        AND char_length(provider_account_scope) <= 255
      ))
      AND adapter_schema_version = btrim(adapter_schema_version)
      AND adapter_schema_version <> ''
      AND char_length(adapter_schema_version) <= 255
      AND normalized_envelope_schema_version = btrim(normalized_envelope_schema_version)
      AND normalized_envelope_schema_version <> ''
      AND char_length(normalized_envelope_schema_version) <= 255
      AND replay_identity_contract_version = btrim(replay_identity_contract_version)
      AND replay_identity_contract_version <> ''
      AND char_length(replay_identity_contract_version) <= 255
      AND capture_mode IN ('singleton', 'bounded_multi_capture')
      AND child_manifest_sha256 ~ '^[0-9a-f]{64}$'
      AND child_count BETWEEN 1 AND 64
      AND (capture_mode <> 'singleton' OR child_count = 1)
      AND amount_minor > 0
      AND currency ~ '^[A-Z]{3}$'
      AND contract_bound_minor > 0
    ),
  CONSTRAINT payment_webhook_source_manifests_parent_identity_check
    CHECK (
      jsonb_typeof(redacted_parent_source_identity) = 'object'
      AND redacted_parent_source_identity - ARRAY['event_type','provider_reference','receiver_reference','provider_customer_reference','provider_paid_at']::text[] = '{}'::jsonb
      AND (NOT redacted_parent_source_identity ? 'event_type' OR jsonb_typeof(redacted_parent_source_identity->'event_type') IN ('string','null'))
      AND (NOT redacted_parent_source_identity ? 'provider_reference' OR jsonb_typeof(redacted_parent_source_identity->'provider_reference') IN ('string','null'))
      AND (NOT redacted_parent_source_identity ? 'receiver_reference' OR jsonb_typeof(redacted_parent_source_identity->'receiver_reference') IN ('string','null'))
      AND (NOT redacted_parent_source_identity ? 'provider_customer_reference' OR jsonb_typeof(redacted_parent_source_identity->'provider_customer_reference') IN ('string','null'))
      AND (NOT redacted_parent_source_identity ? 'provider_paid_at' OR jsonb_typeof(redacted_parent_source_identity->'provider_paid_at') IN ('string','null'))
    ),
  CONSTRAINT payment_webhook_source_manifests_replay_key_uq
    UNIQUE (replay_key_kind, replay_key_digest),
  CONSTRAINT payment_webhook_source_manifests_inbox_target_uq
    UNIQUE (
      id, replay_key_kind, replay_key_digest, provider, endpoint_key,
      signature_key_scope, completion_authority_key, signature_key_identity_id,
      ingress_contract_generation, adapter_schema_version,
      normalized_envelope_schema_version, replay_identity_contract_version
    ),
  CONSTRAINT payment_webhook_source_manifests_binding_uq
    UNIQUE (
      id, replay_key_kind, replay_key_digest, provider, endpoint_key,
      signature_key_scope, completion_authority_key, signature_key_identity_id,
      ingress_contract_generation, adapter_schema_version,
      normalized_envelope_schema_version, replay_identity_contract_version, currency
    ),
  CONSTRAINT payment_webhook_source_manifests_currency_target_uq
    UNIQUE (id, currency)
);

CREATE INDEX payment_webhook_source_manifests_provider_account_idx
  ON private.payment_webhook_source_manifests (
    provider, provider_account_scope, created_at, id
  );

CREATE INDEX payment_webhook_source_manifests_generation_idx
  ON private.payment_webhook_source_manifests (ingress_contract_generation_id, id);

CREATE TABLE private.payment_webhook_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  endpoint_key text NOT NULL,
  signature_key_scope text NOT NULL,
  completion_authority_key text NOT NULL,
  signature_key_identity_id uuid NOT NULL,
  ingress_contract_generation_id uuid NOT NULL,
  ingress_contract_generation bigint NOT NULL,
  adapter_schema_version text NOT NULL,
  normalized_envelope_schema_version text NOT NULL,
  replay_identity_contract_version text NOT NULL,
  replay_key_kind text NOT NULL,
  replay_key_digest text NOT NULL,
  replay_key_preimage jsonb NOT NULL,
  ingress_scope_snapshot jsonb NOT NULL,
  normalized_envelope jsonb NOT NULL,
  normalized_envelope_sha256 text NOT NULL,
  raw_body_sha256 text NOT NULL,
  event_type text NOT NULL,
  provider_reference text,
  amount_minor bigint,
  currency text,
  provider_paid_at timestamptz,
  provider_received_at timestamptz,
  verified_at timestamptz NOT NULL,
  merchant_id uuid,
  provider_account_scope text,
  source_manifest_id uuid NOT NULL,
  capture_mode text NOT NULL,
  child_manifest_sha256 text NOT NULL,
  child_count integer NOT NULL,
  manifest_amount_minor bigint NOT NULL,
  manifest_currency text NOT NULL,
  processing_status text NOT NULL DEFAULT 'received',
  processing_attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  processed_at timestamptz,
  claim_installed_child_count integer NOT NULL DEFAULT 0,
  no_safe_order_claim_child_count integer NOT NULL DEFAULT 0,
  late_ingress_child_count integer NOT NULL DEFAULT 0,
  not_order_protecting_child_count integer NOT NULL DEFAULT 0,
  intake_protection_complete boolean NOT NULL DEFAULT false,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_webhook_inbox_provider_check
    CHECK (provider ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_webhook_inbox_endpoint_key_check
    CHECK (endpoint_key ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_webhook_inbox_signature_scope_check
    CHECK (signature_key_scope ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_webhook_inbox_authority_key_check
    CHECK (completion_authority_key ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_webhook_inbox_generation_fkey
    FOREIGN KEY (
      ingress_contract_generation_id, provider, endpoint_key, signature_key_scope,
      completion_authority_key, signature_key_identity_id, ingress_contract_generation,
      adapter_schema_version, normalized_envelope_schema_version,
      replay_identity_contract_version
    ) REFERENCES private.payment_ingress_contract_generations (
      id, provider, endpoint_key, signature_key_scope, authority_key,
      signature_key_identity_id, generation, parser_contract_version,
      normalized_envelope_schema_version, replay_identity_contract_version
    ) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_webhook_inbox_replay_kind_check
    CHECK (replay_key_kind IN ('svix', 'account_reference', 'fallback_locator')),
  CONSTRAINT payment_webhook_inbox_replay_digest_check
    CHECK (replay_key_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT payment_webhook_inbox_replay_preimage_check
    CHECK (
      jsonb_typeof(replay_key_preimage) = 'object'
      AND jsonb_typeof(replay_key_preimage->'v') = 'number'
      AND replay_key_preimage->>'v' = '1'
      AND replay_key_preimage->>'kind' = replay_key_kind
      AND (
        (
          replay_key_kind = 'svix'
          AND replay_key_preimage ?& ARRAY['v','kind','provider','endpoint_key','signature_key_scope','completion_authority_key','svix_id','event_type']::text[]
          AND replay_key_preimage - ARRAY['v','kind','provider','endpoint_key','signature_key_scope','completion_authority_key','svix_id','event_type']::text[] = '{}'::jsonb
          AND jsonb_typeof(replay_key_preimage->'kind') = 'string'
          AND jsonb_typeof(replay_key_preimage->'provider') = 'string'
          AND jsonb_typeof(replay_key_preimage->'endpoint_key') = 'string'
          AND jsonb_typeof(replay_key_preimage->'signature_key_scope') = 'string'
          AND jsonb_typeof(replay_key_preimage->'completion_authority_key') = 'string'
          AND jsonb_typeof(replay_key_preimage->'svix_id') = 'string'
          AND jsonb_typeof(replay_key_preimage->'event_type') = 'string'
        ) OR (
          replay_key_kind = 'account_reference'
          AND replay_key_preimage ?& ARRAY['v','kind','provider','completion_authority_key','provider_account_scope','provider_reference','event_type']::text[]
          AND replay_key_preimage - ARRAY['v','kind','provider','completion_authority_key','provider_account_scope','provider_reference','event_type']::text[] = '{}'::jsonb
          AND jsonb_typeof(replay_key_preimage->'kind') = 'string'
          AND jsonb_typeof(replay_key_preimage->'provider') = 'string'
          AND jsonb_typeof(replay_key_preimage->'completion_authority_key') = 'string'
          AND jsonb_typeof(replay_key_preimage->'provider_account_scope') = 'string'
          AND jsonb_typeof(replay_key_preimage->'provider_reference') = 'string'
          AND jsonb_typeof(replay_key_preimage->'event_type') = 'string'
        ) OR (
          replay_key_kind = 'fallback_locator'
          AND replay_key_preimage ?& ARRAY['v','kind','provider','endpoint_key','signature_key_scope','completion_authority_key','event_type','reference','amount_minor','currency','provider_paid_at','raw_body_sha256']::text[]
          AND replay_key_preimage - ARRAY['v','kind','provider','endpoint_key','signature_key_scope','completion_authority_key','event_type','reference','amount_minor','currency','provider_paid_at','raw_body_sha256']::text[] = '{}'::jsonb
          AND jsonb_typeof(replay_key_preimage->'kind') = 'string'
          AND jsonb_typeof(replay_key_preimage->'provider') = 'string'
          AND jsonb_typeof(replay_key_preimage->'endpoint_key') = 'string'
          AND jsonb_typeof(replay_key_preimage->'signature_key_scope') = 'string'
          AND jsonb_typeof(replay_key_preimage->'completion_authority_key') = 'string'
          AND jsonb_typeof(replay_key_preimage->'event_type') = 'string'
          AND jsonb_typeof(replay_key_preimage->'reference') = 'string'
          AND jsonb_typeof(replay_key_preimage->'amount_minor') = 'string'
          AND jsonb_typeof(replay_key_preimage->'currency') = 'string'
          AND jsonb_typeof(replay_key_preimage->'provider_paid_at') = 'string'
          AND jsonb_typeof(replay_key_preimage->'raw_body_sha256') = 'string'
        )
      )
    ),
  CONSTRAINT payment_webhook_inbox_ingress_scope_snapshot_check
    CHECK (
      jsonb_typeof(ingress_scope_snapshot) = 'object'
      AND ingress_scope_snapshot ?& ARRAY['merchant_id','provider_account_scope']::text[]
      AND ingress_scope_snapshot - ARRAY['merchant_id','provider_account_scope']::text[] = '{}'::jsonb
      AND jsonb_typeof(ingress_scope_snapshot->'merchant_id') = 'string'
      AND jsonb_typeof(ingress_scope_snapshot->'provider_account_scope') = 'string'
      AND ingress_scope_snapshot->>'merchant_id' = btrim(ingress_scope_snapshot->>'merchant_id')
      AND ingress_scope_snapshot->>'merchant_id' <> ''
      AND ingress_scope_snapshot->>'provider_account_scope' = btrim(ingress_scope_snapshot->>'provider_account_scope')
      AND ingress_scope_snapshot->>'provider_account_scope' <> ''
    ),
  CONSTRAINT payment_webhook_inbox_envelope_check
    CHECK (
      jsonb_typeof(normalized_envelope) = 'object'
      AND normalized_envelope ?& ARRAY['contract_version','event_type','receiver','provider_customer','assignment','economics','paid_time','children']::text[]
      AND normalized_envelope - ARRAY['contract_version','event_type','receiver','provider_customer','assignment','economics','paid_time','children']::text[] = '{}'::jsonb
      AND jsonb_typeof(normalized_envelope->'contract_version') = 'string'
      AND jsonb_typeof(normalized_envelope->'event_type') = 'string'
      AND jsonb_typeof(normalized_envelope->'receiver') IN ('object','null')
      AND jsonb_typeof(normalized_envelope->'provider_customer') IN ('object','null')
      AND jsonb_typeof(normalized_envelope->'assignment') IN ('object','null')
      AND jsonb_typeof(normalized_envelope->'economics') IN ('object','null')
      AND jsonb_typeof(normalized_envelope->'paid_time') IN ('object','null')
      AND jsonb_typeof(normalized_envelope->'children') = 'array'
    ),
  CONSTRAINT payment_webhook_inbox_hashes_check
    CHECK (
      normalized_envelope_sha256 ~ '^[0-9a-f]{64}$'
      AND raw_body_sha256 ~ '^[0-9a-f]{64}$'
      AND child_manifest_sha256 ~ '^[0-9a-f]{64}$'
    ),
  CONSTRAINT payment_webhook_inbox_event_type_check
    CHECK (
      event_type = btrim(event_type)
      AND event_type <> ''
      AND char_length(event_type) <= 255
    ),
  CONSTRAINT payment_webhook_inbox_reference_check
    CHECK (
      (provider_reference IS NULL OR (
        provider_reference = btrim(provider_reference)
        AND provider_reference <> ''
        AND char_length(provider_reference) <= 512
      ))
      AND (provider_account_scope IS NULL OR (
        provider_account_scope = btrim(provider_account_scope)
        AND provider_account_scope <> ''
        AND char_length(provider_account_scope) <= 255
      ))
      AND adapter_schema_version = btrim(adapter_schema_version)
      AND adapter_schema_version <> ''
      AND char_length(adapter_schema_version) <= 255
      AND normalized_envelope_schema_version = btrim(normalized_envelope_schema_version)
      AND normalized_envelope_schema_version <> ''
      AND char_length(normalized_envelope_schema_version) <= 255
      AND replay_identity_contract_version = btrim(replay_identity_contract_version)
      AND replay_identity_contract_version <> ''
      AND char_length(replay_identity_contract_version) <= 255
    ),
  CONSTRAINT payment_webhook_inbox_amount_currency_check
    CHECK (
      (amount_minor IS NULL AND currency IS NULL)
      OR (
        amount_minor IS NOT NULL
        AND currency IS NOT NULL
        AND amount_minor > 0
        AND currency ~ '^[A-Z]{3}$'
      )
    ),
  CONSTRAINT payment_webhook_inbox_manifest_check
    CHECK (
      capture_mode IN ('singleton', 'bounded_multi_capture')
      AND child_count BETWEEN 1 AND 64
      AND (capture_mode <> 'singleton' OR child_count = 1)
      AND manifest_amount_minor > 0
      AND manifest_currency ~ '^[A-Z]{3}$'
    ),
  CONSTRAINT payment_webhook_inbox_processing_check
    CHECK (
      processing_status IN (
        'received', 'unscoped_quarantine', 'intake_protection_recorded',
        'resolution_proposed', 'scope_adopted_receipt_pending', 'resolved',
        'conflict_review', 'terminal_processed'
      )
      AND processing_attempt_count BETWEEN 0 AND 2147483647
    ),
  CONSTRAINT payment_webhook_inbox_error_check
    CHECK (
      last_error IS NULL OR (
        last_error = btrim(last_error)
        AND last_error <> ''
        AND char_length(last_error) <= 4096
      )
    ),
  CONSTRAINT payment_webhook_inbox_decision_projection_check
    CHECK (
      claim_installed_child_count BETWEEN 0 AND child_count
      AND no_safe_order_claim_child_count BETWEEN 0 AND child_count
      AND late_ingress_child_count BETWEEN 0 AND child_count
      AND not_order_protecting_child_count BETWEEN 0 AND child_count
      AND (
        NOT intake_protection_complete
        OR claim_installed_child_count + no_safe_order_claim_child_count
          + late_ingress_child_count + not_order_protecting_child_count = child_count
      )
    ),
  CONSTRAINT payment_webhook_inbox_replay_key_uq
    UNIQUE (replay_key_kind, replay_key_digest),
  CONSTRAINT payment_webhook_inbox_manifest_binding_uq
    UNIQUE (
      id, source_manifest_id, replay_key_kind, replay_key_digest, provider,
      endpoint_key, signature_key_scope, completion_authority_key,
      signature_key_identity_id, ingress_contract_generation,
      adapter_schema_version, normalized_envelope_schema_version,
      replay_identity_contract_version
    ),
  CONSTRAINT payment_webhook_inbox_source_manifest_fkey
    FOREIGN KEY (
      source_manifest_id, replay_key_kind, replay_key_digest, provider,
      endpoint_key, signature_key_scope, completion_authority_key,
      signature_key_identity_id, ingress_contract_generation,
      adapter_schema_version, normalized_envelope_schema_version,
      replay_identity_contract_version
    ) REFERENCES private.payment_webhook_source_manifests (
      id, replay_key_kind, replay_key_digest, provider, endpoint_key,
      signature_key_scope, completion_authority_key, signature_key_identity_id,
      ingress_contract_generation, adapter_schema_version,
      normalized_envelope_schema_version, replay_identity_contract_version
    ) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX payment_webhook_inbox_processing_idx
  ON private.payment_webhook_inbox (processing_status, received_at, id);

CREATE INDEX payment_webhook_inbox_generation_idx
  ON private.payment_webhook_inbox (ingress_contract_generation_id, id);

CREATE INDEX payment_webhook_inbox_source_manifest_idx
  ON private.payment_webhook_inbox (source_manifest_id, id);

ALTER TABLE private.payment_webhook_source_manifests
  ADD CONSTRAINT payment_webhook_source_manifests_inbox_fkey
  FOREIGN KEY (
    inbox_id, id, replay_key_kind, replay_key_digest, provider, endpoint_key,
    signature_key_scope, completion_authority_key, signature_key_identity_id,
    ingress_contract_generation, adapter_schema_version,
    normalized_envelope_schema_version, replay_identity_contract_version
  ) REFERENCES private.payment_webhook_inbox (
    id, source_manifest_id, replay_key_kind, replay_key_digest, provider,
    endpoint_key, signature_key_scope, completion_authority_key,
    signature_key_identity_id, ingress_contract_generation, adapter_schema_version,
    normalized_envelope_schema_version, replay_identity_contract_version
  ) ON DELETE SET NULL (inbox_id) DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX payment_webhook_source_manifests_inbox_idx
  ON private.payment_webhook_source_manifests (inbox_id, id)
  WHERE inbox_id IS NOT NULL;

CREATE TABLE private.payment_webhook_source_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_manifest_id uuid NOT NULL,
  child_identity text NOT NULL,
  child_ordinal integer NOT NULL,
  child_reference text,
  capture_identity text NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  provider_paid_at timestamptz,
  paid_time_precision text NOT NULL,
  child_sha256 text NOT NULL,
  intake_decision text NOT NULL,
  decided_at timestamptz NOT NULL,
  decision_reason_code text NOT NULL,
  review_scope_kind text NOT NULL,
  review_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_webhook_source_proofs_manifest_fkey
    FOREIGN KEY (source_manifest_id)
    REFERENCES private.payment_webhook_source_manifests (id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_webhook_source_proofs_child_identity_check
    CHECK (child_identity ~ '^[a-z][a-z0-9_.:-]{0,254}$'),
  CONSTRAINT payment_webhook_source_proofs_ordinal_check
    CHECK (child_ordinal BETWEEN 1 AND 64),
  CONSTRAINT payment_webhook_source_proofs_reference_check
    CHECK (
      child_reference IS NULL OR (
        child_reference = btrim(child_reference)
        AND child_reference <> ''
        AND char_length(child_reference) <= 512
      )
    ),
  CONSTRAINT payment_webhook_source_proofs_capture_identity_check
    CHECK (
      capture_identity = btrim(capture_identity)
      AND capture_identity <> ''
      AND char_length(capture_identity) <= 512
    ),
  CONSTRAINT payment_webhook_source_proofs_amount_check
    CHECK (amount_minor > 0),
  CONSTRAINT payment_webhook_source_proofs_currency_fkey
    FOREIGN KEY (source_manifest_id, currency)
    REFERENCES private.payment_webhook_source_manifests (id, currency)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT payment_webhook_source_proofs_paid_precision_check
    CHECK (paid_time_precision IN ('exact', 'second', 'minute', 'day', 'unknown')),
  CONSTRAINT payment_webhook_source_proofs_hash_check
    CHECK (child_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT payment_webhook_source_proofs_decision_check
    CHECK (intake_decision IN ('claim_installed', 'no_safe_order_claim', 'late_ingress', 'not_order_protecting')),
  CONSTRAINT payment_webhook_source_proofs_reason_check
    CHECK (decision_reason_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT payment_webhook_source_proofs_review_scope_check
    CHECK (review_scope_kind IN ('none', 'merchant_reconciliation', 'global_quarantine')),
  CONSTRAINT payment_webhook_source_proofs_decision_shape_check
    CHECK (
      (intake_decision IN ('claim_installed', 'not_order_protecting')
        AND review_scope_kind = 'none' AND review_id IS NULL)
      OR (intake_decision IN ('no_safe_order_claim', 'late_ingress')
        AND review_scope_kind IN ('merchant_reconciliation', 'global_quarantine')
        AND review_id IS NOT NULL)
    ),
  CONSTRAINT payment_webhook_source_proofs_manifest_child_uq
    UNIQUE (source_manifest_id, child_identity),
  CONSTRAINT payment_webhook_source_proofs_manifest_ordinal_uq
    UNIQUE (source_manifest_id, child_ordinal),
  CONSTRAINT payment_webhook_source_proofs_manifest_capture_uq
    UNIQUE (source_manifest_id, capture_identity)
);

CREATE INDEX payment_webhook_source_proofs_decision_idx
  ON private.payment_webhook_source_proofs (
    intake_decision, review_scope_kind, decided_at, id
  );

ALTER TABLE private.payment_webhook_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.payment_webhook_inbox FORCE ROW LEVEL SECURITY;
ALTER TABLE private.payment_webhook_source_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.payment_webhook_source_manifests FORCE ROW LEVEL SECURITY;
ALTER TABLE private.payment_webhook_source_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.payment_webhook_source_proofs FORCE ROW LEVEL SECURITY;

CREATE POLICY payment_webhook_inbox_dormant_deny
  ON private.payment_webhook_inbox
  AS RESTRICTIVE
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY payment_webhook_source_manifests_dormant_deny
  ON private.payment_webhook_source_manifests
  AS RESTRICTIVE
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY payment_webhook_source_proofs_dormant_deny
  ON private.payment_webhook_source_proofs
  AS RESTRICTIVE
  FOR ALL
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE private.payment_webhook_inbox FROM PUBLIC;
REVOKE ALL ON TABLE private.payment_webhook_inbox FROM anon;
REVOKE ALL ON TABLE private.payment_webhook_inbox FROM authenticated;
REVOKE ALL ON TABLE private.payment_webhook_inbox FROM service_role;
REVOKE ALL ON TABLE private.payment_webhook_inbox FROM payment_control_plane;
REVOKE ALL ON TABLE private.payment_webhook_source_manifests FROM PUBLIC;
REVOKE ALL ON TABLE private.payment_webhook_source_manifests FROM anon;
REVOKE ALL ON TABLE private.payment_webhook_source_manifests FROM authenticated;
REVOKE ALL ON TABLE private.payment_webhook_source_manifests FROM service_role;
REVOKE ALL ON TABLE private.payment_webhook_source_manifests FROM payment_control_plane;
REVOKE ALL ON TABLE private.payment_webhook_source_proofs FROM PUBLIC;
REVOKE ALL ON TABLE private.payment_webhook_source_proofs FROM anon;
REVOKE ALL ON TABLE private.payment_webhook_source_proofs FROM authenticated;
REVOKE ALL ON TABLE private.payment_webhook_source_proofs FROM service_role;
REVOKE ALL ON TABLE private.payment_webhook_source_proofs FROM payment_control_plane;

COMMENT ON TABLE private.payment_webhook_inbox IS 'Operational webhook replay infrastructure, never completion or financial authority; raw bodies, signatures, credentials, secrets, card data, and full customer addresses are forbidden.';
COMMENT ON TABLE private.payment_webhook_source_manifests IS 'Financial-retention ingress evidence independent of the prunable inbox, never completion authority.';
COMMENT ON TABLE private.payment_webhook_source_proofs IS 'Immutable child ingress evidence and terminal intake-protection decision, never a financial routing, attempt, transaction, allocation, or completion authority.';

COMMIT;
