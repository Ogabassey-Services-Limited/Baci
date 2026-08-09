import {
  getBuilderAiPropShape,
  isAiEditableComponent,
  isBuilderAiPropValue,
} from './builder-ai-component-catalog';
import { isBuilderAiMediaField } from './builder-ai-media-fields';

function isSafeUrl(value: string): boolean {
  if (/\\|[\t\n\r]/.test(value)) return false;
  if (value.startsWith('/')) {
    try {
      return (
        !value.startsWith('//') &&
        new URL(value, 'https://baci.internal').origin ===
          'https://baci.internal'
      );
    } catch {
      return false;
    }
  }
  if (value.startsWith('#')) return value.length > 1;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.length > 0 &&
      parsed.username.length === 0 &&
      parsed.password.length === 0
    );
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeLink(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => key === 'label' || key === 'url') &&
    typeof value.label === 'string' &&
    typeof value.url === 'string' &&
    isSafeUrl(value.url)
  );
}

function hasSafeShape(shape: string, value: unknown): boolean {
  if (shape === 'link') {
    return (
      isRecord(value) &&
      Object.keys(value).every((key) =>
        ['show', 'text', 'url'].includes(key)
      ) &&
      typeof value.show === 'boolean' &&
      typeof value.text === 'string' &&
      typeof value.url === 'string' &&
      isSafeUrl(value.url)
    );
  }
  if (shape === 'link-list') {
    return Array.isArray(value) && value.every(isSafeLink);
  }
  if (shape === 'feature-list') {
    return (
      Array.isArray(value) &&
      value.every(
        (item) =>
          isRecord(item) &&
          Object.keys(item).every((key) =>
            ['description', 'icon', 'title'].includes(key)
          ) &&
          typeof item.description === 'string' &&
          typeof item.title === 'string' &&
          (item.icon === undefined || typeof item.icon === 'string')
      )
    );
  }
  if (shape === 'faq-list') {
    return (
      Array.isArray(value) &&
      value.every(
        (item) =>
          isRecord(item) &&
          typeof item.question === 'string' &&
          typeof item.answer === 'string'
      )
    );
  }
  if (shape === 'legal-section-list') {
    return (
      Array.isArray(value) &&
      value.every(
        (item) =>
          isRecord(item) &&
          typeof item.heading === 'string' &&
          typeof item.content === 'string'
      )
    );
  }
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

export interface SanitizedBuilderAiProps {
  props: Record<string, unknown>;
  warnings: string[];
}

export function sanitizeBuilderAiProps(
  componentType: string,
  patch: Record<string, unknown>
): SanitizedBuilderAiProps {
  if (!isAiEditableComponent(componentType)) {
    return {
      props: {},
      warnings: [`Ignored unsupported ${componentType} component.`],
    };
  }
  const props: Record<string, unknown> = {};
  const unsupported = new Set<string>();
  let mediaAttempted = false;
  let unsafeUrl = false;

  for (const [property, value] of Object.entries(patch)) {
    if (property === 'componentType') continue;
    if (isBuilderAiMediaField(property)) {
      mediaAttempted = true;
      continue;
    }
    const shape = getBuilderAiPropShape(componentType, property);
    if (!shape) {
      unsupported.add(property);
      continue;
    }
    if (shape === 'url' && (typeof value !== 'string' || !isSafeUrl(value))) {
      unsafeUrl = true;
      continue;
    }
    if (
      !hasSafeShape(shape, value) ||
      !isBuilderAiPropValue(componentType, property, value)
    ) {
      unsupported.add(property);
      continue;
    }
    props[property] = value;
  }

  const warnings: string[] = [];
  if (mediaAttempted) {
    warnings.push('Media changes require Baci manual asset controls.');
  }
  if (unsafeUrl) warnings.push(`Ignored unsafe ${componentType} URL.`);
  if (unsupported.size > 0) {
    warnings.push(`Ignored unsupported ${componentType} fields.`);
  }
  return { props, warnings };
}

export { isSafeUrl as isSafeBuilderAiUrl };
