import { compareCodeUnitStrings } from './compare-code-unit-strings';
import type { SupabaseHistoryEffectComponent } from './schemas/supabase-history-effect-component-schema';
import { supabaseHistoryEffectComponentSchema } from './schemas/supabase-history-effect-component-schema';
import { supabaseHistoryEffectScope } from './supabase-history-effect-scope';

type ComponentIdentity = {
  category: SupabaseHistoryEffectComponent['category'];
  identity: string;
};

function functionIdentities(
  functions: Readonly<Record<string, string>>
): string[] {
  return Object.entries(functions).map(
    ([name, identityArguments]) => `${name}(${identityArguments})`
  );
}

function expectedComponentIdentities(): ComponentIdentity[] {
  const scope = supabaseHistoryEffectScope;
  return [
    ...scope.eventPipeline.tables.map((identity) => ({
      category: 'event-relation' as const,
      identity,
    })),
    ...[
      ...functionIdentities(scope.eventPipeline.internalFunctions),
      ...functionIdentities(scope.eventPipeline.publicRpcs),
      ...functionIdentities(scope.fulfillmentCancellation.functions),
      ...functionIdentities(scope.duplicateHistoryFunctions),
    ].map((identity) => ({ category: 'function' as const, identity })),
    ...[
      ...scope.eventPipeline.externalContracts.columns,
      ...scope.fulfillmentCancellation.columns,
    ].map((identity) => ({ category: 'selected-column' as const, identity })),
    ...scope.fulfillmentCancellation.constraints.map((identity) => ({
      category: 'constraint' as const,
      identity,
    })),
    ...scope.eventPipeline.externalContracts.indexes.map((identity) => ({
      category: 'index' as const,
      identity,
    })),
    ...[
      ...scope.eventPipeline.externalContracts.policies,
      `${scope.merchantContainment.relation}.${scope.merchantContainment.anonPolicy}`,
    ].map((identity) => ({ category: 'policy' as const, identity })),
    ...[
      ...scope.eventPipeline.externalContracts.triggers,
      ...scope.fulfillmentCancellation.triggers,
    ].map((identity) => ({ category: 'trigger' as const, identity })),
    ...scope.eventPipeline.externalContracts.producerKeys.map((identity) => ({
      category: 'producer-config' as const,
      identity,
    })),
    {
      category: 'relation-security' as const,
      identity: scope.merchantContainment.relation,
    },
    ...[
      scope.merchantContainment.relation,
      scope.merchantContainment.forbiddenFeatureSettingsRelation,
    ].map((identity) => ({ category: 'grant-vector' as const, identity })),
    ...scope.requiredExtensions.map(({ name, schema }) => ({
      category: 'extension' as const,
      identity: `${schema}.${name}`,
    })),
    {
      category: 'pgmq-queue' as const,
      identity: `${scope.pgmq.schema}.${scope.pgmq.queueName}`,
    },
    ...scope.pgmq.protectedRoles.map((role) => ({
      category: 'pgmq-access' as const,
      identity: `${scope.pgmq.schema}.${role}`,
    })),
    {
      category: 'schema-presence' as const,
      identity: scope.pgmq.forbiddenPublicApiSchema,
    },
  ];
}

function identityKey({ category, identity }: ComponentIdentity): string {
  return `${category}\0${identity}`;
}

export function validateSupabaseHistoryEffectComponents(
  input: readonly unknown[]
): SupabaseHistoryEffectComponent[] {
  const components = input.map((component) =>
    supabaseHistoryEffectComponentSchema.parse(component)
  );
  const actualKeys = components.map(identityKey);
  if (new Set(actualKeys).size !== actualKeys.length) {
    throw new Error('duplicate effect component identity');
  }
  const expectedKeys = expectedComponentIdentities()
    .map(identityKey)
    .sort(compareCodeUnitStrings);
  if (
    JSON.stringify(actualKeys.sort(compareCodeUnitStrings)) !==
    JSON.stringify(expectedKeys)
  ) {
    throw new Error('effect component scope mismatch');
  }
  return components.sort((left, right) =>
    compareCodeUnitStrings(identityKey(left), identityKey(right))
  );
}
