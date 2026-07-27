-- Local replay contract: the frozen production 19-function receipt stays untouched.
BEGIN;
DO $$
DECLARE
  v_actual_count integer;
  v_catalog_drift boolean;
BEGIN
  WITH expected(schema_name, function_name, identity_arguments, definition_sha256, configuration, security_definer, acl) AS (VALUES
    ('public','claim_event_deliveries_v1','p_batch_size integer, p_worker_id text, p_lease_seconds integer','91045717dacebd1e5c2ca5dedfbbcaaddf2b37caee5b58c6272cd6167f91bd5b','search_path=""|statement_timeout=5s',true,'postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','claim_storefront_cache_transition_deliveries_v1','p_batch_size integer, p_worker_id text, p_lease_seconds integer, p_deadline_seconds integer','80e819757892efb0a686f5223c0dff08c5f44f32b0e8a2bb54011d8df2704b16','search_path=""|statement_timeout=5s',true,'postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','cleanup_domain_event_pipeline_v1','p_delivered_attempt_retention interval, p_queue_archive_retention interval','c7a93d54a9fa311abcd2d0ba097f25e3e656d029b9a71983db3984753a038f12','search_path=""|statement_timeout=30s',true,'postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','dead_letter_ingress_event_v1','p_queue_message_id bigint, p_domain_event_id uuid, p_original_envelope jsonb, p_failure_code text, p_failure_message text, p_parser_version integer','e288989457603808d265f577bac916593dbdd38b4aa5c46c679ec27a71708b3d','search_path=""|statement_timeout=5s',true,'postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','enqueue_domain_event_v1','p_producer text, p_trust_level text, p_idempotency_key text, p_external_event_id text, p_event_name text, p_subject_type text, p_subject_id text, p_merchant_id uuid, p_source jsonb, p_data jsonb, p_metadata jsonb, p_occurred_at timestamp with time zone, p_changed_fields text[], p_correlation_id text, p_causation_id uuid','f6cd691b04aed8cc410715c8d8f18ee4271754c94f71550d447ca49c6eae2d9f','search_path=""|statement_timeout=5s',true,'postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','finish_event_delivery_v1','p_delivery_id uuid, p_claim_token uuid, p_outcome text, p_available_at timestamp with time zone, p_error_code text, p_error_message text, p_http_status integer, p_provider_response_id text','85c2911ab7dfeaaa52436d18b40cfc310b0c9c63852eabfa7a90d25ea52c3f0a','search_path=""|statement_timeout=5s',true,'postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','finish_storefront_cache_transition_delivery_v1','p_delivery_id uuid, p_claim_token uuid, p_obligation_id uuid, p_generation bigint, p_receipt jsonb, p_outcome text, p_available_at timestamp with time zone, p_error_code text, p_error_message text, p_http_status integer','00fb554170b8e95a12d6d4767115f2f6b25e0da6e9427e7fd37375f2addf300c','search_path=""|statement_timeout=5s',true,'postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','get_domain_event_queue_metrics_v1','','ffc9982edf77631240903419706f39d92798c3930d37b9800cbc74f5f38e3e93','search_path=""|statement_timeout=2s',true,'postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','get_event_pipeline_operations_v1','','37728209e23b0118fb8744340c1ec72f1ed8fd5a9f9751fe9ce5921862224544','search_path=""|statement_timeout=3s',true,'authenticated:EXECUTE:f,postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','is_event_ingress_capability_v1','p_kind text, p_merchant_id uuid, p_event_type text, p_event_name text, p_event_id text, p_event_timestamp timestamp with time zone, p_producer text, p_source text, p_trust_level text','163f44ade54ddfad35f5eccdbe2c10b2f8939b4a3585c3f5b52eeed3a149609e','search_path=""',false,'anon:EXECUTE:f,authenticated:EXECUTE:f,postgres:EXECUTE:f,service_role:EXECUTE:f,unknown (OID=0):EXECUTE:f'),
    ('public','list_event_pipeline_deliveries_v1','p_status text, p_limit integer, p_offset integer, p_destination text, p_error_code text, p_merchant_id uuid, p_from timestamp with time zone, p_to timestamp with time zone','8354671e982fbafb7440bd78bf12a0b487146c8b002102f7985d0c2375643160','search_path=""|statement_timeout=5s',true,'authenticated:EXECUTE:f,postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','list_event_pipeline_ingress_failures_v1','p_limit integer, p_offset integer, p_error_code text, p_merchant_id uuid, p_from timestamp with time zone, p_to timestamp with time zone','9298ee260ec3790ffbb4aca9f0d50558fea0794b594456888a0dfcda8d50394e','search_path=""|statement_timeout=5s',true,'authenticated:EXECUTE:f,postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','read_domain_events_v1','p_visibility_timeout_seconds integer, p_batch_size integer, p_max_poll_seconds integer','ead9bcfc02f188aa124cdeb205b4c73830648d81bc1654f95ea372656b395c34','search_path=""|statement_timeout=10s',true,'postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','record_analytics_domain_event_v1','p_merchant_id uuid, p_event_type text, p_event_name text, p_event_data jsonb, p_domain_event_data jsonb, p_delivery_data jsonb, p_external_event_id text, p_source text, p_producer text, p_trust_level text, p_event_timestamp timestamp with time zone, p_metadata jsonb','06e484044bcb5b7d666a9166af67be19622cd53827765118ad0ebba0e665121b','search_path=""|statement_timeout=5s',true,'anon:EXECUTE:f,postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','record_event_worker_heartbeat_v1','p_worker_name text, p_worker_id text, p_status text, p_processed_count integer, p_error_code text','9f430f1550efef0b50008f7e20f559a6a8b1a7a907a3889ed8ed0b26953363dc','search_path=""|statement_timeout=2s',true,'postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','record_platform_domain_event_v1','p_event_type text, p_event_name text, p_event_data jsonb, p_delivery_data jsonb, p_external_event_id text, p_merchant_id uuid, p_session_id text, p_page_url text, p_referrer text, p_producer text, p_trust_level text, p_event_timestamp timestamp with time zone, p_metadata jsonb','bc4a87d0e9d90b3d438a741ae4e7a65a928f5881e860d8f00938bf3815e9b8b3','search_path=""|statement_timeout=5s',true,'anon:EXECUTE:f,postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','replay_event_deliveries_batch_v1','p_delivery_ids uuid[], p_replayed_by uuid, p_replay_reason text','5038f282e800e84a2632719d6d3b089475808b0b4aaf48faa82f1a9250d8cb16','search_path=""|statement_timeout=10s',true,'authenticated:EXECUTE:f,postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','replay_event_delivery_v1','p_delivery_id uuid, p_replayed_by uuid, p_replay_reason text','7714321fade4d7ae4c02dda2a3afa32b55b4e157077d6b267ae5a78d94e3a851','search_path=""|statement_timeout=5s',true,'postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','replay_ingress_dead_letter_v1','p_failure_id uuid, p_replayed_by uuid, p_replay_reason text','c302a10a6646e1daf32c7e14a1985a2b677fb6d514568f88ad74c375ecda5c53','search_path=""|statement_timeout=5s',true,'authenticated:EXECUTE:f,postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','route_domain_event_v1','p_queue_message_id bigint, p_domain_event_id uuid, p_destinations text[], p_shadow boolean, p_active_destinations text[]','1d9ddc41d672c75d44c7c382a5d64b65ea6ce9649044a09649c72110d2578e15','search_path=""|statement_timeout=5s',true,'postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','route_storefront_cache_transition_v1','p_queue_message_id bigint, p_domain_event_id uuid, p_worker_id text','82f06add95963a0102404531f7a78599e2260ab55ce3ab651ce49fc160ab8850','search_path=""|statement_timeout=5s',true,'postgres:EXECUTE:f,service_role:EXECUTE:f'),
    ('public','select_event_pipeline_replay_ids_v1','p_status text, p_destination text, p_error_code text, p_merchant_id uuid, p_from timestamp with time zone, p_to timestamp with time zone','b3cf78a47e7c2c08c47086dc2c80ea6e2467bdf19276c574049fe4ca3a20f805','search_path=""|statement_timeout=5s',true,'authenticated:EXECUTE:f,postgres:EXECUTE:f,service_role:EXECUTE:f')
  ), actual AS (
    SELECT namespace.nspname, proc.proname, pg_get_function_identity_arguments(proc.oid),
      encode(extensions.digest(pg_get_functiondef(proc.oid), 'sha256'), 'hex'),
      coalesce(array_to_string(proc.proconfig, '|'), ''), proc.prosecdef,
      coalesce((SELECT string_agg(format('%s:%s:%s', coalesce(pg_get_userbyid(acl.grantee), 'PUBLIC'), acl.privilege_type, acl.is_grantable), ',' ORDER BY coalesce(pg_get_userbyid(acl.grantee), 'PUBLIC'), acl.privilege_type, acl.is_grantable) FROM aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) AS acl), '')
    FROM expected
    JOIN pg_namespace AS namespace ON namespace.nspname = expected.schema_name
    JOIN pg_proc AS proc ON proc.pronamespace = namespace.oid AND proc.proname = expected.function_name
  ), catalog AS (
    SELECT count(*) AS actual_count,
      EXISTS ((TABLE expected EXCEPT TABLE actual) UNION ALL (TABLE actual EXCEPT TABLE expected)) AS drift
    FROM actual
  )
  SELECT actual_count, drift INTO v_actual_count, v_catalog_drift FROM catalog;
  IF v_actual_count <> 22 OR v_catalog_drift THEN
    RAISE EXCEPTION 'local event pipeline catalog identity, digest, configuration, security, or ACL drift';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger AS trigger
    WHERE trigger.tgrelid = 'public.categories'::regclass
      AND trigger.tgname = 'zz_capture_category_cache_transition_v1'
      AND trigger.tgtype & 2 = 0
      AND trigger.tgtype & 64 = 0
  ) THEN
    RAISE EXCEPTION 'category cache trigger must be AFTER';
  END IF;
END;
$$;
ROLLBACK;
