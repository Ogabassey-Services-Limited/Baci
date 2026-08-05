import type { BuilderData } from '@baci/shared/contracts';
import { createBuilderComponentId } from './create-builder-component-id';

function withId(
  component: BuilderData['content'][number],
  createId: (componentType: string) => string
): BuilderData['content'][number] {
  const id = component.props.id;
  if (typeof id === 'string' && id.length > 0) return component;
  return {
    ...component,
    props: { ...component.props, id: createId(component.type) },
  };
}

function isComponent(value: unknown): value is BuilderData['content'][number] {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { type?: unknown }).type === 'string' &&
    typeof (value as { props?: unknown }).props === 'object' &&
    (value as { props?: unknown }).props !== null &&
    !Array.isArray((value as { props?: unknown }).props)
  );
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
            isComponent(component) ? withId(component, createId) : component
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
