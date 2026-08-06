import type { BuilderData } from '@baci/shared/contracts';
import { createBuilderComponentId } from './create-builder-component-id';

function withId(
  component: BuilderData['content'][number],
  createId: (componentType: string) => string
): BuilderData['content'][number] {
  const id = component.props.id;
  if (
    typeof id === 'string' &&
    id === id.trim() &&
    id.length > 0 &&
    id.length <= 120
  ) {
    return component;
  }
  return {
    ...component,
    props: { ...component.props, id: createId(component.type) },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isComponent(value: unknown): value is BuilderData['content'][number] {
  return (
    isRecord(value) && typeof value.type === 'string' && isRecord(value.props)
  );
}

function normalizeZoneComponent(
  value: unknown,
  createId: (componentType: string) => string
): unknown {
  if (!isRecord(value) || typeof value.type !== 'string') return value;
  const component = {
    ...value,
    props: isRecord(value.props) ? value.props : {},
  } as BuilderData['content'][number];
  return withId(component, createId);
}

export function normalizeBuilderAiComponentIds(
  config: BuilderData,
  createId: (componentType: string) => string = createBuilderComponentId
): BuilderData {
  const content = config.content.map((component) =>
    withId(component, createId)
  );
  const zones = Object.fromEntries(
    Object.entries(config.zones ?? {}).map(([name, zone]) => [
      name,
      Array.isArray(zone)
        ? zone.map((component) =>
            isComponent(component)
              ? withId(component, createId)
              : normalizeZoneComponent(component, createId)
          )
        : zone,
    ])
  );
  return {
    ...config,
    content,
    ...(config.zones ? { zones } : {}),
  };
}
