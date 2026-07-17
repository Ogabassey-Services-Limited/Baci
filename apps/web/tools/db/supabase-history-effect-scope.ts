type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

function deepFreeze<T extends object>(value: T): DeepReadonly<T> {
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    if (
      typeof nested === 'object' &&
      nested !== null &&
      !Object.isFrozen(nested)
    ) {
      deepFreeze(nested);
    }
  }
  return value as DeepReadonly<T>;
}

const scope = {
  scopeVersion: 'baci-p0-effects-v3',
  eventPipeline: {
    tables: [
      'public.domain_event_failure_replays',
      'public.domain_event_failures',
      'public.domain_event_ledger',
      'public.domain_event_producer_config',
      'public.event_deliveries',
      'public.event_delivery_attempts',
      'public.event_delivery_replays',
      'public.event_pipeline_worker_heartbeats',
    ],
    internalFunctions: {
      'eventing.capture_order_domain_event_v1': '',
      'eventing.capture_product_domain_event_v1': '',
      'eventing.capture_transaction_domain_event_v1': '',
      'eventing.enqueue_domain_event_v1':
        'p_producer text, p_trust_level text, p_idempotency_key text, p_external_event_id text, p_event_name text, p_subject_type text, p_subject_id text, p_merchant_id uuid, p_source jsonb, p_data jsonb, p_metadata jsonb, p_occurred_at timestamp with time zone, p_changed_fields text[], p_correlation_id text, p_causation_id uuid',
      'eventing.finish_event_delivery_v1':
        'p_delivery_id uuid, p_claim_token uuid, p_outcome text, p_available_at timestamp with time zone, p_error_code text, p_error_message text, p_http_status integer, p_provider_response_id text',
      'eventing.is_event_pipeline_operator_v1': '',
      'eventing.resolve_domain_event_duplicate_v1':
        'p_producer text, p_trust_level text, p_idempotency_key text, p_external_event_id text, p_event_name text, p_subject_type text, p_subject_id text, p_merchant_id uuid, p_data jsonb',
    },
    publicRpcs: {
      'public.claim_event_deliveries_v1':
        'p_batch_size integer, p_worker_id text, p_lease_seconds integer',
      'public.cleanup_domain_event_pipeline_v1':
        'p_delivered_attempt_retention interval, p_queue_archive_retention interval',
      'public.dead_letter_ingress_event_v1':
        'p_queue_message_id bigint, p_domain_event_id uuid, p_original_envelope jsonb, p_failure_code text, p_failure_message text, p_parser_version integer',
      'public.enqueue_domain_event_v1':
        'p_producer text, p_trust_level text, p_idempotency_key text, p_external_event_id text, p_event_name text, p_subject_type text, p_subject_id text, p_merchant_id uuid, p_source jsonb, p_data jsonb, p_metadata jsonb, p_occurred_at timestamp with time zone, p_changed_fields text[], p_correlation_id text, p_causation_id uuid',
      'public.finish_event_delivery_v1':
        'p_delivery_id uuid, p_claim_token uuid, p_outcome text, p_available_at timestamp with time zone, p_error_code text, p_error_message text, p_http_status integer, p_provider_response_id text',
      'public.get_domain_event_queue_metrics_v1': '',
      'public.get_event_pipeline_operations_v1': '',
      'public.is_event_ingress_capability_v1':
        'p_kind text, p_merchant_id uuid, p_event_type text, p_event_name text, p_event_id text, p_event_timestamp timestamp with time zone, p_producer text, p_source text, p_trust_level text',
      'public.list_event_pipeline_deliveries_v1':
        'p_status text, p_limit integer, p_offset integer, p_destination text, p_error_code text, p_merchant_id uuid, p_from timestamp with time zone, p_to timestamp with time zone',
      'public.list_event_pipeline_ingress_failures_v1':
        'p_limit integer, p_offset integer, p_error_code text, p_merchant_id uuid, p_from timestamp with time zone, p_to timestamp with time zone',
      'public.read_domain_events_v1':
        'p_visibility_timeout_seconds integer, p_batch_size integer, p_max_poll_seconds integer',
      'public.record_analytics_domain_event_v1':
        'p_merchant_id uuid, p_event_type text, p_event_name text, p_event_data jsonb, p_domain_event_data jsonb, p_delivery_data jsonb, p_external_event_id text, p_source text, p_producer text, p_trust_level text, p_event_timestamp timestamp with time zone, p_metadata jsonb',
      'public.record_event_worker_heartbeat_v1':
        'p_worker_name text, p_worker_id text, p_status text, p_processed_count integer, p_error_code text',
      'public.record_platform_domain_event_v1':
        'p_event_type text, p_event_name text, p_event_data jsonb, p_delivery_data jsonb, p_external_event_id text, p_merchant_id uuid, p_session_id text, p_page_url text, p_referrer text, p_producer text, p_trust_level text, p_event_timestamp timestamp with time zone, p_metadata jsonb',
      'public.replay_event_deliveries_batch_v1':
        'p_delivery_ids uuid[], p_replayed_by uuid, p_replay_reason text',
      'public.replay_event_delivery_v1':
        'p_delivery_id uuid, p_replayed_by uuid, p_replay_reason text',
      'public.replay_ingress_dead_letter_v1':
        'p_failure_id uuid, p_replayed_by uuid, p_replay_reason text',
      'public.route_domain_event_v1':
        'p_queue_message_id bigint, p_domain_event_id uuid, p_destinations text[], p_shadow boolean, p_active_destinations text[]',
      'public.select_event_pipeline_replay_ids_v1':
        'p_status text, p_destination text, p_error_code text, p_merchant_id uuid, p_from timestamp with time zone, p_to timestamp with time zone',
    },
    externalContracts: {
      columns: ['public.platform_events.event_id'],
      indexes: [
        'public.analytics_events_merchant_event_id_type_uidx',
        'public.platform_events_type_event_id_uidx',
      ],
      policies: [
        'public.analytics_events.Event ingress capability inserts analytics events',
        'public.platform_events.Event ingress capability inserts platform events',
      ],
      producerKeys: [
        'catalog.products',
        'commerce.orders',
        'payments.transactions',
      ],
      triggers: [
        'public.orders.capture_order_domain_event_v1',
        'public.products.capture_product_domain_event_insert_delete_v1',
        'public.products.capture_product_domain_event_update_v1',
        'public.transactions.capture_transaction_domain_event_v1',
      ],
    },
  },
  fulfillmentCancellation: {
    columns: [
      'public.orders.cancellation_reason',
      'public.orders.cancelled_at',
      'public.orders.cancelled_by',
      'public.orders.delivered_at',
      'public.orders.shipped_at',
    ],
    constraints: [
      'public.orders.orders_cancelled_by_check',
      'public.reconciliation_review.reconciliation_review_issue_type_check',
    ],
    functions: {
      'private.order_customer_cancellable': 'p_order_id uuid',
      'private.restock_order_items': 'p_order_id uuid',
      'public.cancel_order_as_customer': 'p_order_id uuid, p_reason text',
      'public.customer_order_can_cancel': 'p_order_id uuid',
      'public.prevent_cancelled_order_reopen': '',
    },
    triggers: ['public.orders.prevent_cancelled_order_reopen'],
  },
  duplicateHistoryFunctions: {
    'public.close_due_product_quiz_events': '',
    'public.finalize_due_quiz_events': '',
    'public.mint_quiz_event_ranked_awards': 'p_event_id uuid',
    'public.register_push_token':
      'p_token text, p_merchant_id uuid, p_platform text, p_device_name text, p_app_type text, p_build_number integer',
    'public.storefront_merchant_has_paystack_subaccount': 'p_merchant_id uuid',
  },
  merchantContainment: {
    relation: 'public.merchants',
    anonPolicy: 'Anon can view merchants',
    rowLevelSecurity: { enabled: true, forced: false },
    tablePrivileges: { PUBLIC: [], anon: [] },
    publicSelectableColumns: [],
    anonSelectableColumns: [
      'about_page',
      'bank_account_name',
      'bank_account_number',
      'bank_code',
      'bank_name',
      'brand_colors',
      'business_address',
      'business_name',
      'business_type',
      'cac_rc_number',
      'country',
      'created_at',
      'email',
      'email_domain',
      'email_domain_verified',
      'email_logo_url',
      'email_sender_name',
      'endpoint_id',
      'endpoint_scheme_id',
      'facebook_pixel_id',
      'faq_items',
      'favicon_apple_touch_url',
      'favicon_png_192_url',
      'favicon_png_32_url',
      'favicon_svg_url',
      'favicon_uploaded_at',
      'feature_settings',
      'firs_business_id',
      'firs_service_id',
      'gmc_variants_enabled',
      'google_analytics_id',
      'hero_image_ids',
      'hero_images_generated_at',
      'hero_images_regeneration_count',
      'hero_slides',
      'id',
      'is_published',
      'kyc_status',
      'legal_entity_name',
      'lga_code',
      'logo_url',
      'mobile_hero_slides',
      'multi_currency_enabled',
      'offline_conversions_enabled',
      'order_prefix',
      'pages',
      'payout_currency',
      'phone',
      'plan_expires_at',
      'plan_started_at',
      'plan_tier',
      'premium_features',
      'published_at',
      'published_config',
      'registered_address',
      'rider_phone_number',
      'self_fulfillment_enabled',
      'signup_source',
      'site_description',
      'site_tagline',
      'site_title',
      'slug',
      'snapchat_pixel_id',
      'social_media',
      'state_code',
      'support_email',
      'support_phone',
      'tax_exempt',
      'tax_identification_number',
      'template_id',
      'tiktok_pixel_id',
      'trust_profile',
      'twitter_pixel_id',
      'updated_at',
      'user_id',
      'vat_rate',
      'vat_registration_status',
    ],
    anonForbiddenColumns: [
      'bvn',
      'cac_number',
      'facebook_capi_access_token',
      'facebook_capi_token',
      'firs_certificate',
      'firs_email',
      'firs_password_encrypted',
      'firs_public_key',
      'ga4_api_secret',
      'google_product_sheet_url',
      'is_platform_admin',
      'nin',
      'paystack_subaccount_code',
      'snapchat_capi_token',
      'stripe_customer_id',
      'stripe_subscription_id',
      'tiktok_access_token',
      'virtual_terminal_code',
    ],
    forbiddenFeatureSettingsRelation: 'public.merchant_feature_settings',
    forbiddenFeatureSettingsReadRoles: ['PUBLIC', 'anon'],
  },
  requiredExtensions: [
    { name: 'pgcrypto', schema: 'extensions' },
    { name: 'pgmq', schema: 'pgmq' },
  ],
  pgmq: {
    schema: 'pgmq',
    queueName: 'domain_events',
    relations: ['a_domain_events', 'meta', 'q_domain_events'],
    protectedRoles: ['PUBLIC', 'anon', 'authenticated', 'service_role'],
    privilegeKinds: ['function-execute', 'schema-usage', 'table-access'],
    forbiddenPublicApiSchema: 'pgmq_public',
  },
} as const;

export const supabaseHistoryEffectScope = deepFreeze(scope);
