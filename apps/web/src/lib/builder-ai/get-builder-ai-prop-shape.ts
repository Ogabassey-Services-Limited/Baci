import { getAiComponentDefinition } from './get-ai-component-definition';
import { isAiEditableComponent } from './is-ai-editable-component';

export type BuilderAiPropShape =
  | 'feature-list'
  | 'faq-list'
  | 'legal-section-list'
  | 'link'
  | 'link-list'
  | 'primitive'
  | 'url';

const structuredPropShapes: Record<
  string,
  Record<string, BuilderAiPropShape>
> = {
  Button: { link: 'url' },
  FAQ: { items: 'faq-list' },
  Features: { features: 'feature-list' },
  Footer: { quickLinks: 'link-list' },
  Header: { ctaButton: 'link', navigationLinks: 'link-list' },
  Hero: { ctaLink: 'url' },
  LegalSection: { sections: 'legal-section-list' },
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
