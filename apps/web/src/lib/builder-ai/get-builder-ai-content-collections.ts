import type { BuilderData } from '@baci/shared/contracts';

export type BuilderAiComponent = BuilderData['content'][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBuilderAiComponent(value: unknown): value is BuilderAiComponent {
  return (
    isRecord(value) && typeof value.type === 'string' && isRecord(value.props)
  );
}

function isBuilderAiComponentList(
  value: unknown
): value is BuilderAiComponent[] {
  return Array.isArray(value) && value.every(isBuilderAiComponent);
}

export function getBuilderAiContentCollections(
  config: BuilderData
): BuilderAiComponent[][] {
  const zoneCollections = Object.values(config.zones ?? {}).flatMap((zone) =>
    isBuilderAiComponentList(zone) ? [zone] : []
  );
  return [config.content, ...zoneCollections];
}
