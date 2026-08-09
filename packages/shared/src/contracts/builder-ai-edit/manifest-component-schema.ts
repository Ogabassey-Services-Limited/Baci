import { z } from 'zod';
import { builderDesignCapabilities } from '../builder-design-capabilities';
import type {
  BuilderDesignItem,
  BuilderDesignProp,
  BuilderDesignProps,
} from '../builder-design-capability-props';
import { builderAiFeatureIconNames } from './feature-icons';
import { safeStorefrontUrlSchema } from './safe-storefront-url';
import { manifestBuilderAiCapability } from './validate-manifest-capability';

type ManifestComponent = { componentType: string } & Record<string, unknown>;
type ManifestSchemaMode = 'edit' | 'insert';

function withBounds(schema: z.ZodType, descriptor: BuilderDesignProp) {
  if (descriptor.type === 'number') {
    let bounded = z.number();
    if (descriptor.wholeNumber) bounded = bounded.int();
    if (descriptor.minimum !== undefined)
      bounded = bounded.min(descriptor.minimum);
    if (descriptor.maximum !== undefined)
      bounded = bounded.max(descriptor.maximum);
    return bounded;
  }
  if (descriptor.type === 'string') {
    return z
      .string()
      .trim()
      .min(1)
      .max(descriptor.maximumLength ?? Number.MAX_SAFE_INTEGER);
  }
  return schema;
}

function compileItem(item: BuilderDesignItem) {
  const fields: Record<string, z.ZodType> = {};
  for (const [name, descriptor] of Object.entries(item.properties)) {
    const schema = compileProp(descriptor);
    fields[name] = descriptor.required ? schema : schema.optional();
  }
  return z.strictObject(fields);
}

function compileProp(descriptor: BuilderDesignProp): z.ZodType {
  if (descriptor.enum) {
    return z.enum(descriptor.enum as [string, ...string[]]);
  }
  if (descriptor.type === 'boolean') return z.boolean();
  if (descriptor.type === 'number' || descriptor.type === 'string') {
    return withBounds(z.unknown(), descriptor);
  }
  if (descriptor.type === 'safe-link') return safeStorefrontUrlSchema;
  if (descriptor.type === 'safe-media') {
    return z
      .string()
      .trim()
      .min(1)
      .max(descriptor.maximumLength ?? 512);
  }
  if (descriptor.type === 'feature-icon') {
    return z.enum(builderAiFeatureIconNames);
  }
  if (descriptor.type === 'object' && descriptor.item) {
    return compileItem(descriptor.item);
  }
  if (descriptor.type === 'array' && descriptor.item) {
    const uniqueBy = descriptor.item.uniqueBy;
    let items = z.array(compileItem(descriptor.item));
    if (descriptor.minimumItems !== undefined)
      items = items.min(descriptor.minimumItems);
    if (descriptor.maximumItems !== undefined)
      items = items.max(descriptor.maximumItems);
    return items.refine(
      (value) =>
        uniqueBy === undefined ||
        new Set(value.map((item) => item[uniqueBy])).size === value.length,
      'Expected unique array members'
    );
  }
  return z.string().trim().min(1);
}

function compileComponentSchema(
  componentType: string,
  props: BuilderDesignProps,
  mode: ManifestSchemaMode
) {
  const fields: Record<string, z.ZodType> = {
    componentType: z.literal(componentType),
  };
  for (const [property, descriptor] of Object.entries(props)) {
    fields[property] = compileProp(descriptor).optional();
  }
  const schema = z.strictObject(fields);
  return mode === 'edit'
    ? schema.refine(
        (value) => Object.keys(value).some((key) => key !== 'componentType'),
        'Expected at least one editable component field'
      )
    : schema;
}

export function getManifestComponentSchema(mode: ManifestSchemaMode) {
  const capabilities = builderDesignCapabilities.components.filter(
    (capability) =>
      capability.aiEditable && (mode === 'edit' || capability.aiInsertable)
  );
  const schemas = capabilities.map(({ componentType, props }) =>
    compileComponentSchema(componentType, props, mode)
  );
  const schema = z.union(
    schemas as unknown as [z.ZodType, z.ZodType, ...z.ZodType[]]
  );
  return schema.refine(
    mode === 'edit'
      ? manifestBuilderAiCapability.isComponentPatch
      : manifestBuilderAiCapability.isInsert,
    'Expected manifest-authorized component fields'
  ) as z.ZodType<ManifestComponent>;
}
