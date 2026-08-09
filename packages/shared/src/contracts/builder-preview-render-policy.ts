import type { BuilderData } from './builder-ai-edit';
import { builderDesignCapabilityAdapter } from './builder-design-capability-adapter';

const MAX_STORE_NAME_LENGTH = 120;
const MAX_GRADIENT_LENGTH = 512;
const MAX_CAROUSEL_SLIDES = 5;
const PREVIEW_CAROUSEL_IMAGE = '/placeholder.png';
const componentIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
const componentSlotZoneKeyPattern =
  /^([A-Za-z0-9][A-Za-z0-9_-]{0,119}):([A-Za-z][A-Za-z0-9_-]{0,79})$/;
const colorPattern =
  /^(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|var\(--(?:store|theme)-[a-z][a-z0-9-]{0,48}\))$/;
const assetPathPattern = /^\/(?!\/)[A-Za-z0-9._~!$&*+,=@%/-]{1,480}$/;
const animationTypes = new Set([
  'none',
  'fade-in',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'zoom-in',
  'scale-up',
]);
const animatedComponentTypes = new Set([
  'Hero',
  'Text',
  'Features',
  'FAQ',
  'LegalSection',
]);
const gradientColor =
  '(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|var\\(--(?:store|theme)-[a-z][a-z0-9-]{0,48}\\))';
const gradientPattern = new RegExp(
  `^(?:linear-gradient\\((?:[0-9]{1,3}deg, )?${gradientColor}(?:, ${gradientColor}){1,7}\\)|radial-gradient\\(${gradientColor}(?:, ${gradientColor}){1,7}\\))$`
);

type PreviewComponentIdentity = { id: string; type: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedText(value: unknown, maximum: number): boolean {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim() === value &&
    value.length <= maximum
  );
}

function isSafeColor(value: unknown): boolean {
  return typeof value === 'string' && colorPattern.test(value);
}

function isSafeAssetPath(value: unknown): boolean {
  return typeof value === 'string' && assetPathPattern.test(value);
}

function isSafeGradient(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value.length <= MAX_GRADIENT_LENGTH &&
    gradientPattern.test(value)
  );
}

function isAnimationProp(
  componentType: string,
  property: string,
  value: unknown
): boolean | undefined {
  if (!animatedComponentTypes.has(componentType)) return undefined;
  if (property === 'animationType')
    return typeof value === 'string' && animationTypes.has(value);
  if (property === 'animationDuration')
    return value === 'fast' || value === 'normal' || value === 'slow';
  if (property === 'animationDelay')
    return typeof value === 'number' && value >= 0 && value <= 5;
  if (property === 'animationTrigger')
    return value === 'immediate' || value === 'scroll' || value === 'onload';
  return undefined;
}

function isPreviewCarouselSlide(value: unknown): boolean {
  if (!isRecord(value) || Object.keys(value).length === 0) return false;
  const specialProps =
    builderDesignCapabilityAdapter.getSpecialProps(
      'HeroCarousel',
      'updateCarouselSlide'
    ) ?? {};
  return (
    Object.keys(value).some((key) => Object.keys(specialProps).includes(key)) &&
    Object.entries(value).every(([property, propValue]) => {
      if (propValue === undefined) return false;
      if (property === 'image') return isSafeAssetPath(propValue);
      return builderDesignCapabilityAdapter.isSpecialPropValue(
        'HeroCarousel',
        'updateCarouselSlide',
        property,
        propValue
      );
    })
  );
}

function isPreviewCarouselProp(property: string, value: unknown): boolean {
  if (property === 'autoplayDelay')
    return (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 1_000 &&
      value <= 10_000
    );
  return (
    property === 'slides' &&
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_CAROUSEL_SLIDES &&
    value.every(isPreviewCarouselSlide)
  );
}

function isCuratedRenderProp(
  componentType: string,
  property: string,
  value: unknown
): boolean {
  const animation = isAnimationProp(componentType, property, value);
  if (animation !== undefined) return animation;
  if (componentType === 'Header') {
    if (property === 'backgroundColor' || property === 'textColor')
      return isSafeColor(value);
    if (property === 'storeName')
      return isBoundedText(value, MAX_STORE_NAME_LENGTH);
    if (property === 'logoUrl' || property === 'backgroundImage')
      return isSafeAssetPath(value);
    return property === 'showAccount' && typeof value === 'boolean';
  }
  if (componentType === 'HeroCarousel')
    return isPreviewCarouselProp(property, value);
  if (componentType === 'ProductGrid') {
    return (
      property === 'sortBy' &&
      (value === 'newest' ||
        value === 'price-low' ||
        value === 'price-high' ||
        value === 'name')
    );
  }
  if (componentType === 'Footer') {
    if (
      property === 'brandName' ||
      property === 'quickLinksLabel' ||
      property === 'socialLinksLabel'
    ) {
      return isBoundedText(value, MAX_STORE_NAME_LENGTH);
    }
    return (
      property === 'socialLinks' &&
      isRecord(value) &&
      Object.keys(value).length === 0
    );
  }
  if (componentType !== 'Hero') return false;
  if (property === 'headingLevel')
    return ['h1', 'h2', 'div'].includes(String(value));
  if (property === 'backgroundImage') return isSafeAssetPath(value);
  if (property === 'backgroundGradient') return isSafeGradient(value);
  return false;
}

function isReviewedProp(
  componentType: string,
  property: string,
  value: unknown
): boolean {
  if (value === undefined) return false;
  const capability =
    builderDesignCapabilityAdapter.getCapability(componentType);
  if (!capability) return false;
  if (Object.keys(capability.props).includes(property))
    return builderDesignCapabilityAdapter.isPropValue(
      componentType,
      property,
      value
    );
  if (
    capability.initialProps &&
    Object.keys(capability.initialProps).includes(property) &&
    Object.is(capability.initialProps[property], value)
  ) {
    return true;
  }
  return isCuratedRenderProp(componentType, property, value);
}

function getPuckComponentIdentity(
  value: unknown
): PreviewComponentIdentity | undefined {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => key !== 'props' && key !== 'type')
  )
    return;
  const type = value.type;
  if (typeof type !== 'string' || !isRecord(value.props)) return;
  const id = value.props.id;
  if (typeof id !== 'string' || !componentIdPattern.test(id)) return;
  if (type === 'Flex') {
    return Object.keys(value.props).every((key) => key === 'id')
      ? { id, type }
      : undefined;
  }
  const capability = builderDesignCapabilityAdapter.getCapability(type);
  if (!capability?.renderable || capability.refused) return;
  return Object.entries(value.props).every(
    ([property, propValue]) =>
      property === 'id' || isReviewedProp(type, property, propValue)
  )
    ? { id, type }
    : undefined;
}

function parsePuckZoneKey(
  value: string
): { parentId: string; slot: string } | undefined {
  const match = componentSlotZoneKeyPattern.exec(value);
  return match ? { parentId: match[1], slot: match[2] } : undefined;
}

function allowsPuckZoneSlot(type: string, slot: string): boolean {
  return type === 'Flex' && slot === 'children';
}

function projectPreviewCarouselComponent(
  component: BuilderData['content'][number]
): BuilderData['content'][number] {
  if (
    component.type !== 'HeroCarousel' ||
    !Array.isArray(component.props.slides)
  )
    return component;
  return {
    ...component,
    props: {
      ...component.props,
      slides: component.props.slides.map((slide) => {
        if (!isRecord(slide)) return slide;
        const { image: _image, ...reviewed } = slide;
        return { ...reviewed, image: PREVIEW_CAROUSEL_IMAGE };
      }),
    },
  };
}

function projectPreviewCandidate(value: BuilderData): BuilderData {
  const zones = value.zones;
  return {
    ...value,
    content: value.content.map(projectPreviewCarouselComponent),
    ...(zones === undefined
      ? {}
      : {
          zones: Object.fromEntries(
            Object.entries(zones).map(([key, collection]) => [
              key,
              Array.isArray(collection)
                ? collection.map(projectPreviewCarouselComponent)
                : collection,
            ])
          ),
        }),
  };
}

export const previewRenderPolicy = {
  allowsPuckZoneSlot,
  getPuckComponentIdentity,
  isPuckComponent: (value: unknown, componentIds: Set<string>) => {
    const identity = getPuckComponentIdentity(value);
    if (!identity || componentIds.has(identity.id)) return false;
    componentIds.add(identity.id);
    return true;
  },
  isPuckZoneKey: (value: string) => parsePuckZoneKey(value) !== undefined,
  parsePuckZoneKey,
  projectPreviewCandidate,
};
