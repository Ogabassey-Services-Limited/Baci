import ts from 'typescript';
import { EVENT_PIPELINE_FUNCTION_NAMES } from './event-pipeline-database';

const typescriptApplication = [
  'claim_event_deliveries_v1',
  'dead_letter_ingress_event_v1',
  'enqueue_domain_event_v1',
  'finish_event_delivery_v1',
  'get_event_pipeline_operations_v1',
  'list_event_pipeline_deliveries_v1',
  'list_event_pipeline_ingress_failures_v1',
  'read_domain_events_v1',
  'record_analytics_domain_event_v1',
  'record_event_worker_heartbeat_v1',
  'record_platform_domain_event_v1',
  'replay_event_deliveries_batch_v1',
  'replay_ingress_dead_letter_v1',
  'route_domain_event_v1',
  'select_event_pipeline_replay_ids_v1',
] as const;

export const eventPipelineBoundaryManifest = {
  allFunctions: EVENT_PIPELINE_FUNCTION_NAMES,
  frozenRoutes: {
    'apps/web/src/app/api/analytics/ads/route.ts':
      'b714f0bedeed7bded973fbe743c74517622ea8e0069dfca35051752dc45571dd',
    'apps/web/src/app/api/analytics/facebook-capi/route.ts':
      'f41e1de587645b8fdb2af8af180eb581b2bfeecae688670d7b5c7a80088b7c32',
    'apps/web/src/app/api/analytics/ga4/route.ts':
      '9e9b8c3edb1636d2f27e9551568d5036778fce6ab54272f1fd3b77cfd0f88c9f',
    'apps/web/src/app/api/analytics/snapchat/route.ts':
      '1a7898d59038b6a37e057e74da3907f4a42da9c25c7236e9d324d7b1516e4cd3',
    'apps/web/src/app/api/analytics/tiktok/route.ts':
      '4d59510f6a72ae25dd45c8cc8ea6762a709bf745286140a7a9e1aa4b64ee942e',
    'apps/web/src/app/api/platform/events/route.ts':
      'bb3b5ea163f7029bd8a90523ac7944c9e126b2aebc0ce673f82c4e0c48d00161',
  },
  functions: {
    serviceRoleMetrics: ['get_domain_event_queue_metrics_v1'],
    sqlInternal: ['is_event_ingress_capability_v1', 'replay_event_delivery_v1'],
    typescriptApplication,
    vpsCleanup: ['cleanup_domain_event_pipeline_v1'],
  },
  operations: {
    analytics_events: ['insert'],
    domains: ['select'],
    merchant_feature_settings: ['select'],
    merchant_slug_aliases: ['select'],
    merchants: ['select'],
    order_items: ['select'],
    orders: ['select'],
    platform_events: ['insert'],
    platform_settings: ['select'],
  },
  projections: {
    conversion: { merchants: ['country', 'payout_currency'] },
    identity: {
      domains: ['merchant_id'],
      merchant_slug_aliases: ['merchant_id'],
      merchants: ['id'],
    },
    legacyAnalyticsWrite: {
      analytics_events: [
        'merchant_id',
        'event_type',
        'event_data',
        'event_timestamp',
        'source',
        'event_id',
      ],
    },
    legacyPlatformWrite: {
      platform_events: [
        'event_data',
        'event_id',
        'event_timestamp',
        'event_type',
        'ip_address',
        'merchant_id',
        'page_url',
        'referrer',
        'session_id',
        'user_agent',
      ],
    },
    merchantFeatureProviderConfig: {
      merchant_feature_settings: [
        'facebook_pixel_id',
        'facebook_capi_token',
        'tiktok_pixel_id',
        'tiktok_access_token',
        'google_analytics_id',
        'ga4_api_secret',
        'snapchat_pixel_id',
        'snapchat_capi_token',
      ],
    },
    merchantProviderConfig: {
      merchants: [
        'plan_tier',
        'plan_expires_at',
        'premium_features',
        'offline_conversions_enabled',
        'facebook_pixel_id',
        'facebook_capi_token',
        'tiktok_pixel_id',
        'tiktok_access_token',
        'google_analytics_id',
        'ga4_api_secret',
        'snapchat_pixel_id',
        'snapchat_capi_token',
      ],
    },
    paidDelivery: {
      order_items: ['id', 'product_id', 'name', 'price', 'quantity'],
      orders: [
        'id',
        'merchant_id',
        'order_number',
        'payment_status',
        'total',
        'currency',
        'customer_email',
        'customer_phone',
        'customer_name',
        'customer_id',
        'shipping_address',
        'ad_tracking',
      ],
    },
    platformProviderConfig: {
      platform_settings: [
        'google_analytics_id',
        'ga4_api_secret',
        'facebook_pixel_id',
        'facebook_capi_token',
      ],
    },
  },
  // Task 6 owns the only possible two-wrapper exception. P0 authorizes none.
  trustedWrapperImporters: [],
} as const;

export function eventPipelineMemberName(
  expression: ts.Expression
): string | undefined {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (
    ts.isElementAccessExpression(expression) &&
    expression.argumentExpression &&
    (ts.isStringLiteral(expression.argumentExpression) ||
      ts.isNoSubstitutionTemplateLiteral(expression.argumentExpression))
  )
    return expression.argumentExpression.text;
  return undefined;
}

function scopeOf(node: ts.Node): ts.Node {
  let current = node.parent;
  while (
    current &&
    !ts.isSourceFile(current) &&
    !ts.isBlock(current) &&
    !ts.isFunctionLike(current)
  )
    current = current.parent;
  return current ?? node.getSourceFile();
}

function isAncestor(ancestor: ts.Node, node: ts.Node): boolean {
  let current: ts.Node | undefined = node;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

export function eventPipelineBindingInitializer(
  sourceFile: ts.SourceFile,
  name: string,
  at: ts.Node
): { found: boolean; initializer?: ts.Expression } {
  let best: ts.VariableDeclaration | ts.ParameterDeclaration | undefined;
  function visit(node: ts.Node) {
    if (
      (ts.isVariableDeclaration(node) || ts.isParameter(node)) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.pos < at.pos &&
      isAncestor(scopeOf(node), at) &&
      (!best || node.pos > best.pos)
    )
      best = node;
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return best
    ? { found: true, initializer: best.initializer }
    : { found: false };
}

export function eventPipelineStaticText(
  expression: ts.Expression | undefined,
  sourceFile: ts.SourceFile,
  at: ts.Node
): string | undefined {
  if (!expression) return undefined;
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  )
    return expression.text;
  if (!ts.isIdentifier(expression)) return undefined;
  const binding = eventPipelineBindingInitializer(
    sourceFile,
    expression.text,
    at
  );
  return binding.found
    ? eventPipelineStaticText(binding.initializer, sourceFile, at)
    : undefined;
}

export function eventPipelineRpcCallable(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
  at: ts.CallExpression
): boolean {
  if (eventPipelineMemberName(expression) === 'rpc') return true;
  if (!ts.isIdentifier(expression)) return false;
  const initializer = eventPipelineBindingInitializer(
    sourceFile,
    expression.text,
    at
  ).initializer;
  if (!initializer) return false;
  if (eventPipelineMemberName(initializer) === 'rpc') return true;
  if (
    ts.isCallExpression(initializer) &&
    eventPipelineMemberName(initializer.expression) === 'bind' &&
    (ts.isPropertyAccessExpression(initializer.expression) ||
      ts.isElementAccessExpression(initializer.expression))
  )
    return eventPipelineMemberName(initializer.expression.expression) === 'rpc';
  return eventPipelineRpcCallable(initializer, sourceFile, at);
}

export function eventPipelineProjectionColumns(table: string): Set<string> {
  const columns = new Set<string>();
  for (const authority of Object.values(
    eventPipelineBoundaryManifest.projections
  )) {
    const projection = authority as Readonly<Record<string, readonly string[]>>;
    for (const column of projection[table] ?? []) columns.add(column);
  }
  return columns;
}

export function findEventPipelineFromCall(
  expression: ts.Expression,
  sourceFile?: ts.SourceFile,
  at?: ts.Node
): ts.CallExpression | undefined {
  if (ts.isIdentifier(expression) && sourceFile && at) {
    const initializer = eventPipelineBindingInitializer(
      sourceFile,
      expression.text,
      at
    ).initializer;
    return initializer
      ? findEventPipelineFromCall(initializer, sourceFile, at)
      : undefined;
  }
  if (!ts.isCallExpression(expression)) return undefined;
  if (eventPipelineMemberName(expression.expression) === 'from')
    return expression;
  if (
    ts.isPropertyAccessExpression(expression.expression) ||
    ts.isElementAccessExpression(expression.expression)
  )
    return findEventPipelineFromCall(
      expression.expression.expression,
      sourceFile,
      at
    );
  return undefined;
}
