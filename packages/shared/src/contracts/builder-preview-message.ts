import { z } from 'zod';
import { type BuilderData, builderDataSchema } from './builder-ai-edit';
import { validateBuilderAiEditComplexity } from './builder-ai-edit/complexity-validator';
import { builderDesignCapabilities } from './builder-design-capabilities';
import { previewRenderPolicy } from './builder-preview-render-policy';

const MAX_MERCHANT_IDENTIFIER_LENGTH = 128;
const MAX_BASE_PATH_LENGTH = 240;
const MAX_STOREFRONT_ORIGIN_LENGTH = 2_048;
const MAX_REVISION = 2_147_483_647;
const MAX_ERROR_CODE_LENGTH = 64;
const candidateConfigKeys = new Set(['content', 'root', 'theme', 'zones']);
const sensitiveKeyPattern =
  /(?:api[-_]?key|authorization|credential|password|private[-_]?key|secret|token)/i;
const basePathPattern = /^\/(?:[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*)?$/;
const errorCodePattern = /^[a-z][a-z0-9_]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStorefrontOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.length > 0 &&
      parsed.username.length === 0 &&
      parsed.password.length === 0 &&
      parsed.origin === value
    );
  } catch {
    return false;
  }
}

function hasSensitiveField(
  value: unknown,
  visited = new WeakSet<object>()
): boolean {
  if (!value || typeof value !== 'object') return false;
  if (visited.has(value)) return false;
  visited.add(value);
  return Object.entries(value).some(
    ([key, entry]) =>
      sensitiveKeyPattern.test(key) || hasSensitiveField(entry, visited)
  );
}

function hasValidPuckCollections(value: BuilderData): boolean {
  const componentIds = new Set<string>();
  if (Object.keys(value).some((key) => !candidateConfigKeys.has(key))) {
    return false;
  }
  if (
    !isRecord(value.root) ||
    (value.theme !== undefined && !isRecord(value.theme))
  ) {
    return false;
  }
  if (
    !value.content.every((component) =>
      previewRenderPolicy.isPuckComponent(component, componentIds)
    )
  ) {
    return false;
  }
  if (value.zones === undefined) return true;
  return (
    isRecord(value.zones) &&
    Object.entries(value.zones).every(
      ([zoneKey, collection]) =>
        previewRenderPolicy.isPuckZoneKey(zoneKey) &&
        Array.isArray(collection) &&
        collection.every((component) =>
          previewRenderPolicy.isPuckComponent(component, componentIds)
        )
    )
  );
}

const candidateConfigSchema = builderDataSchema.superRefine(
  (value, context) => {
    if (!hasValidPuckCollections(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Expected a known Puck configuration',
      });
    }
    if (hasSensitiveField(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Preview configuration must not include secret-shaped fields',
      });
    }
    const complexity = validateBuilderAiEditComplexity(value);
    if (!complexity.success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Preview configuration exceeds supported complexity',
      });
    }
  }
);

const merchantSchema = z.strictObject({
  basePath: z
    .string()
    .trim()
    .min(1)
    .max(MAX_BASE_PATH_LENGTH)
    .regex(basePathPattern)
    .optional(),
  id: z.string().trim().min(1).max(MAX_MERCHANT_IDENTIFIER_LENGTH),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(MAX_MERCHANT_IDENTIFIER_LENGTH)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  storefrontOrigin: z
    .string()
    .trim()
    .min(1)
    .max(MAX_STOREFRONT_ORIGIN_LENGTH)
    .refine(isStorefrontOrigin, 'Expected an https storefront origin')
    .optional(),
});

export const builderPreviewMessageSchema = z.strictObject({
  candidateConfig: candidateConfigSchema,
  capabilityHash: z.literal(builderDesignCapabilities.capabilityHash),
  capabilityVersion: z.literal(builderDesignCapabilities.capabilityVersion),
  merchant: merchantSchema,
  revision: z.number().int().min(0).max(MAX_REVISION),
  type: z.literal('baci.builder-preview.render'),
  version: z.literal(1),
});

const readyResponseSchema = z.strictObject({
  capabilityHash: z.literal(builderDesignCapabilities.capabilityHash),
  capabilityVersion: z.literal(builderDesignCapabilities.capabilityVersion),
  type: z.literal('baci.builder-preview.ready'),
  version: z.literal(1),
});

const renderedResponseSchema = z.strictObject({
  revision: z.number().int().min(0).max(MAX_REVISION),
  type: z.literal('baci.builder-preview.rendered'),
  version: z.literal(1),
});

const errorResponseSchema = z.strictObject({
  code: z.string().min(1).max(MAX_ERROR_CODE_LENGTH).regex(errorCodePattern),
  type: z.literal('baci.builder-preview.error'),
  version: z.literal(1),
});

export const builderPreviewResponseSchema = z.discriminatedUnion('type', [
  readyResponseSchema,
  renderedResponseSchema,
  errorResponseSchema,
]);

export type BuilderPreviewMessage = z.infer<typeof builderPreviewMessageSchema>;
export type BuilderPreviewResponse = z.infer<
  typeof builderPreviewResponseSchema
>;
