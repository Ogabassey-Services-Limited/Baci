import { builderAiFeatureIconNames } from '@baci/shared/contracts';
import { getBuilderAiPropShape } from './get-builder-ai-prop-shape';

export const builderAiEnumProps: Record<string, readonly string[]> = {
  'Header.layout': [
    'logo-left-nav-center',
    'logo-left-nav-right',
    'logo-center',
  ],
  'Header.paddingY': ['sm', 'md', 'lg'],
  'Header.searchRadius': ['none', 'sm', 'md', 'full'],
  'Header.searchStyle': ['outline', 'filled', 'minimal'],
  'Hero.align': ['center', 'left', 'right'],
  'Hero.padding': ['large', 'medium', 'small'],
  'Text.align': ['center', 'left', 'right'],
};

export const builderAiNumberRanges: Record<
  string,
  readonly [number, number, boolean?]
> = {
  'Features.columns': [2, 4, true],
  'ProductGrid.columns': [2, 4, true],
  'ProductGrid.limit': [1, 24, true],
  'Testimonial.rating': [0, 5, true],
};

const booleanProps = new Set([
  'Footer.showNewsletter',
  'Footer.showQuickLinks',
  'Header.glassEffect',
  'Header.showCart',
  'Header.showLogo',
  'Header.showMenu',
  'Header.showSearch',
  'Header.sticky',
  'Hero.overlay',
  'ProductGrid.showFilters',
]);
const stringProps = new Set([
  'Features.subtitle',
  'Features.title',
  'Footer.copyrightText',
  'Hero.ctaText',
  'Hero.subtitle',
  'Hero.title',
  'Newsletter.buttonText',
  'Newsletter.description',
  'Newsletter.placeholder',
  'Newsletter.title',
  'ProductGrid.title',
  'Testimonial.author',
  'Testimonial.quote',
  'Testimonial.role',
  'Text.content',
  'Text.title',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isBuilderAiPropValue(
  componentType: string,
  property: string,
  value: unknown
): boolean {
  const key = `${componentType}.${property}`;
  if (booleanProps.has(key)) return typeof value === 'boolean';
  if (stringProps.has(key)) return typeof value === 'string';
  if (builderAiEnumProps[key])
    return typeof value === 'string' && builderAiEnumProps[key].includes(value);
  const range = builderAiNumberRanges[key];
  if (range)
    return (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= range[0] &&
      value <= range[1] &&
      (!range[2] || Number.isInteger(value))
    );
  if (key === 'Features.features')
    return (
      Array.isArray(value) &&
      value.every(
        (feature) =>
          isRecord(feature) &&
          (feature.icon === undefined ||
            builderAiFeatureIconNames.some((icon) => icon === feature.icon))
      )
    );
  return getBuilderAiPropShape(componentType, property) !== 'primitive';
}
