import { safeStorefrontUrlSchema } from './builder-ai-edit/safe-storefront-url';
import { builderDesignCapabilityAdapter } from './builder-design-capability-adapter';

const MAX_COMPONENT_ID_LENGTH = 120;
const MAX_COLOR_LENGTH = 64;
const MAX_STORE_NAME_LENGTH = 120;
const MAX_GRADIENT_LENGTH = 512;
const componentIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
const rootZoneKeyPattern = /^[a-z][a-z0-9_-]{0,79}$/;
const componentSlotZoneKeyPattern =
  /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}:[A-Za-z][A-Za-z0-9_-]{0,79}$/;
const colorPattern = /^(?:#[0-9a-fA-F]{3,8}|var\(--[a-z][a-z0-9-]{0,48}\))$/;
const gradientPattern = /^(?:linear|radial)-gradient\([^\\;{}]{1,480}\)$/;
const animationTypes = [
  'none',
  'fade-in',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'zoom-in',
  'scale-up',
];

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
  return (
    typeof value === 'string' &&
    value.length <= MAX_COLOR_LENGTH &&
    colorPattern.test(value)
  );
}

function isSafeAssetUrl(value: unknown): boolean {
  const parsed = safeStorefrontUrlSchema.safeParse(value);
  return parsed.success && !parsed.data.startsWith('#');
}

function isSafeGradient(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value.length <= MAX_GRADIENT_LENGTH &&
    gradientPattern.test(value)
  );
}

function isCuratedRenderProp(
  componentType: string,
  property: string,
  value: unknown
): boolean {
  if (componentType === 'Header') {
    if (property === 'backgroundColor' || property === 'textColor') {
      return isSafeColor(value);
    }
    if (property === 'storeName') {
      return isBoundedText(value, MAX_STORE_NAME_LENGTH);
    }
    if (property === 'logoUrl' || property === 'backgroundImage') {
      return isSafeAssetUrl(value);
    }
    return property === 'showAccount' && typeof value === 'boolean';
  }
  if (componentType === 'Hero') {
    if (property === 'headingLevel') {
      return value === 'h1' || value === 'h2' || value === 'div';
    }
    if (property === 'backgroundImage') return isSafeAssetUrl(value);
    if (property === 'backgroundGradient') return isSafeGradient(value);
    if (property === 'animationType') {
      return typeof value === 'string' && animationTypes.includes(value);
    }
    if (property === 'animationDuration') {
      return value === 'fast' || value === 'normal' || value === 'slow';
    }
    if (property === 'animationDelay') {
      return typeof value === 'number' && value >= 0 && value <= 5;
    }
    return (
      property === 'animationTrigger' &&
      (value === 'immediate' || value === 'scroll')
    );
  }
  return false;
}

function isReviewedProp(
  componentType: string,
  property: string,
  value: unknown
): boolean {
  const capability =
    builderDesignCapabilityAdapter.getCapability(componentType);
  if (!capability) return false;
  if (Object.keys(capability.props).includes(property)) {
    return builderDesignCapabilityAdapter.isPropValue(
      componentType,
      property,
      value
    );
  }
  if (Object.is(capability.initialProps?.[property], value)) return true;
  return isCuratedRenderProp(componentType, property, value);
}

function isPreviewRenderSafePuckComponent(
  value: unknown,
  componentIds: Set<string>
): boolean {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some((key) => key !== 'props' && key !== 'type')) {
    return false;
  }
  const componentType = value.type;
  if (typeof componentType !== 'string' || !isRecord(value.props)) {
    return false;
  }
  const capability =
    builderDesignCapabilityAdapter.getCapability(componentType);
  if (!capability?.renderable || capability.refused) return false;
  const id = value.props.id;
  if (
    typeof id !== 'string' ||
    id.length > MAX_COMPONENT_ID_LENGTH ||
    !componentIdPattern.test(id) ||
    componentIds.has(id)
  ) {
    return false;
  }
  componentIds.add(id);
  return Object.entries(value.props).every(
    ([property, propValue]) =>
      property === 'id' || isReviewedProp(componentType, property, propValue)
  );
}

function isPreviewRenderSafePuckZoneKey(value: string): boolean {
  return (
    rootZoneKeyPattern.test(value) || componentSlotZoneKeyPattern.test(value)
  );
}

export const previewRenderPolicy = {
  isPuckComponent: isPreviewRenderSafePuckComponent,
  isPuckZoneKey: isPreviewRenderSafePuckZoneKey,
};
