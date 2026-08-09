import type {
  BuilderAiModelOperation,
  BuilderData,
} from '@baci/shared/contracts';
import { areBuilderAiPropValuesEqual } from './are-builder-ai-prop-values-equal';
import { sanitizeBuilderAiProps } from './sanitize-builder-ai-props';

type BuilderComponent = BuilderData['content'][number];

export function applyBuilderAiComponentPatch(
  component: BuilderComponent,
  patch: Record<string, unknown>
): string[] {
  const sanitized = sanitizeBuilderAiProps(component.type, patch);
  if (
    !Object.entries(sanitized.props).some(
      ([key, value]) =>
        !areBuilderAiPropValuesEqual(component.props[key], value)
    )
  ) {
    return [...sanitized.warnings, `No safe changes for ${component.type}.`];
  }
  component.props = { ...component.props, ...sanitized.props };
  return sanitized.warnings;
}

export function applyBuilderAiCarouselPatch(
  component: BuilderComponent,
  operation: Extract<
    BuilderAiModelOperation,
    { kind: 'update_carousel_slide' }
  >,
  createError: (message: string) => Error
): string[] {
  if (
    component.type !== 'HeroCarousel' ||
    !Array.isArray(component.props.slides)
  ) {
    throw createError('Carousel target was not found');
  }
  const slide = component.props.slides[operation.slideIndex];
  if (!slide || typeof slide !== 'object' || Array.isArray(slide)) {
    throw createError('Carousel slide was not found');
  }
  const patch = Object.fromEntries(
    ['ctaLink', 'ctaText', 'subtitle', 'title'].flatMap((key) =>
      operation[key as keyof typeof operation] === undefined
        ? []
        : [[key, operation[key as keyof typeof operation]]]
    )
  );
  const sanitized = sanitizeBuilderAiProps(
    'HeroCarousel',
    patch,
    'updateCarouselSlide'
  );
  const nextTitle = sanitized.props.title;
  if (
    typeof nextTitle === 'string' &&
    component.props.slides.some(
      (item, index) =>
        index !== operation.slideIndex &&
        item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        (item as Record<string, unknown>).title === nextTitle
    )
  ) {
    throw createError('Carousel slide title must be unique');
  }
  if (
    !Object.entries(sanitized.props).some(
      ([key, value]) => (slide as Record<string, unknown>)[key] !== value
    )
  ) {
    return [...sanitized.warnings, 'No safe changes for HeroCarousel.'];
  }
  component.props.slides = component.props.slides.map((item, index) =>
    index === operation.slideIndex
      ? { ...(item as Record<string, unknown>), ...sanitized.props }
      : item
  );
  return sanitized.warnings;
}
