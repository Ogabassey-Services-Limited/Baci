import { describe, expect, it } from 'vitest';
import type { SupabaseHistoryEffectComponent } from './schemas/supabase-history-effect-component-schema';
import { summarizeSupabaseHistoryEffects } from './summarize-supabase-history-effects';
import { supabaseHistoryEffectScope } from './supabase-history-effect-scope';
import { createSupabaseHistoryEffectTestFixture } from './supabase-history-effect-test-fixture';

type BooleanSummaryKey =
  | 'merchantAnonProjectionExact'
  | 'pgmqDomainEventsQueuePresent'
  | 'pgmqProtectedRolesWithheld'
  | 'requiredExtensionsPresent';

type SummaryDriftCase = readonly [
  key: BooleanSummaryKey,
  override: SupabaseHistoryEffectComponent,
];

const scope = supabaseHistoryEffectScope;

const driftCases: readonly SummaryDriftCase[] = [
  [
    'merchantAnonProjectionExact',
    {
      category: 'relation-security',
      identity: scope.merchantContainment.relation,
      value: { enabled: true, forced: true },
    },
  ],
  [
    'pgmqDomainEventsQueuePresent',
    {
      category: 'pgmq-queue',
      identity: `${scope.pgmq.schema}.${scope.pgmq.queueName}`,
      value: { meta: { present: false }, relations: [] },
    },
  ],
  [
    'pgmqProtectedRolesWithheld',
    {
      category: 'pgmq-access',
      identity: `${scope.pgmq.schema}.${scope.pgmq.protectedRoles[0]}`,
      value: { effectiveSchemaUsage: true, rolePresent: true },
    },
  ],
  [
    'requiredExtensionsPresent',
    {
      category: 'extension',
      identity: `${scope.requiredExtensions[0].schema}.${scope.requiredExtensions[0].name}`,
      value: { name: scope.requiredExtensions[0].name, schema: 'public' },
    },
  ],
];

describe('summarizeSupabaseHistoryEffects fail-closed coverage', () => {
  it.each(
    driftCases
  )('sets %s false when its material value drifts', (key, override) => {
    const fixture = createSupabaseHistoryEffectTestFixture({
      overrides: [override],
    });

    expect(summarizeSupabaseHistoryEffects(fixture.components)[key]).toBe(
      false
    );
  });

  it('sets the cancellation surface false when required evidence is missing', () => {
    const fixture = createSupabaseHistoryEffectTestFixture();
    const components = fixture.components.filter(
      ({ category, identity }) =>
        category !== 'constraint' ||
        identity !== 'public.orders.orders_cancelled_by_check'
    );

    expect(
      summarizeSupabaseHistoryEffects(components)
        .customerCancellationSurfacePresent
    ).toBe(false);
  });

  it('reports component-count drift while retaining the scope-derived RPC count', () => {
    const fixture = createSupabaseHistoryEffectTestFixture();
    const summary = summarizeSupabaseHistoryEffects(
      fixture.components.slice(1)
    );

    expect(summary.componentCount).toBe(75);
    expect(summary.domainEventRpcCount).toBe(19);
  });
});
