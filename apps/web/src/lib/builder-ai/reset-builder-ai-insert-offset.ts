import type { BuilderAiComponent } from './get-builder-ai-content-collections';

export function resetBuilderAiInsertOffset(
  offsets: WeakMap<BuilderAiComponent[], Map<string, number>>,
  content: BuilderAiComponent[],
  componentId: string
): void {
  offsets.get(content)?.delete(`after:${componentId}`);
}
