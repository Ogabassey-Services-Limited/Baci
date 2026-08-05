import type { BuilderData } from '@baci/shared/contracts';
import { getBuilderComponentId } from './get-builder-component-id';

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

export function findBuilderAiComponent(
  config: BuilderData,
  id: string
): { content: BuilderAiComponent[]; index: number } | undefined {
  for (const content of getBuilderAiContentCollections(config)) {
    const index = content.findIndex(
      (component) => getBuilderComponentId(component) === id
    );
    if (index >= 0) return { content, index };
  }
  return undefined;
}

export function hasDuplicateBuilderAiComponentIds(
  config: BuilderData
): boolean {
  const ids = new Set<string>();
  for (const content of getBuilderAiContentCollections(config)) {
    for (const component of content) {
      const id = getBuilderComponentId(component);
      if (id && ids.has(id)) return true;
      if (id) ids.add(id);
    }
  }
  return false;
}
