import { builderDesignCapabilityAdapter } from '@baci/shared/contracts';
import { isBuilderAiMediaField } from './builder-ai-media-fields';

export interface SanitizedBuilderAiProps {
  props: Record<string, unknown>;
  warnings: string[];
}

export function sanitizeBuilderAiProps(
  componentType: string,
  patch: Record<string, unknown>
): SanitizedBuilderAiProps {
  const capability =
    builderDesignCapabilityAdapter.getCapability(componentType);
  if (!capability?.aiEditable) {
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
    const descriptor = capability.props[property];
    if (descriptor?.type === 'safe-media' || isBuilderAiMediaField(property)) {
      mediaAttempted = true;
      continue;
    }
    if (!descriptor) {
      unsupported.add(property);
      continue;
    }
    if (
      descriptor.type === 'safe-link' &&
      !builderDesignCapabilityAdapter.isSafeUrl(value)
    ) {
      unsafeUrl = true;
      continue;
    }
    if (
      !builderDesignCapabilityAdapter.isPropValue(
        componentType,
        property,
        value
      )
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

export const isSafeBuilderAiUrl = builderDesignCapabilityAdapter.isSafeUrl;
