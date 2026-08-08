import { getAiComponentDefinition } from './get-ai-component-definition';
import { isAiEditableComponent } from './is-ai-editable-component';

export type BuilderAiPropShape =
  | 'feature-list'
  | 'link'
  | 'link-list'
  | 'primitive'
  | 'url';

const structuredPropShapes: Record<
  string,
  Record<string, BuilderAiPropShape>
> = {
  Features: { features: 'feature-list' },
  Footer: { quickLinks: 'link-list' },
  Header: { ctaButton: 'link', navigationLinks: 'link-list' },
  Hero: { ctaLink: 'url' },
};

export function getBuilderAiPropShape(
  componentType: string,
  property: string
): BuilderAiPropShape | undefined {
  if (
    !isAiEditableComponent(componentType) ||
    !getAiComponentDefinition(componentType).editableProps.includes(property)
  ) {
    return undefined;
  }
  return structuredPropShapes[componentType]?.[property] ?? 'primitive';
}
