import { z } from 'zod';
import { StorefrontPublicProjectionPayloadSchema } from './public-projection-payload-schema';

const MAX_NON_STREAMED_RPC_DTO_BYTES = 4_194_304;
const MAX_JSON_NESTING_DEPTH = 64;

type JsonPreflightFrame =
  | Readonly<{ depth: number; kind: 'enter'; value: unknown }>
  | Readonly<{ kind: 'exit'; value: object }>;

function findJsonTransportIssue(value: unknown): string | null {
  const ancestors = new WeakSet<object>();
  const seen = new WeakSet<object>();
  const frames: JsonPreflightFrame[] = [{ depth: 0, kind: 'enter', value }];

  try {
    while (frames.length > 0) {
      const frame = frames.pop();
      if (!frame) break;
      if (frame.kind === 'exit') {
        ancestors.delete(frame.value);
        continue;
      }

      const current = frame.value;
      if (
        current === null ||
        typeof current === 'string' ||
        typeof current === 'boolean'
      )
        continue;
      if (typeof current === 'number') {
        if (!Number.isFinite(current))
          return 'projection contains a non-JSON number';
        continue;
      }
      if (typeof current !== 'object')
        return 'projection contains a non-JSON value';
      if (frame.depth > MAX_JSON_NESTING_DEPTH)
        return 'projection exceeds the maximum JSON nesting depth';
      if (ancestors.has(current)) return 'projection contains a JSON cycle';
      if (seen.has(current))
        return 'projection contains a shared JSON reference';

      const isArray = Array.isArray(current);
      const prototype = Object.getPrototypeOf(current);
      if (
        (isArray && prototype !== Array.prototype) ||
        (!isArray && prototype !== Object.prototype && prototype !== null)
      )
        return 'projection contains a non-plain JSON object';

      seen.add(current);
      ancestors.add(current);
      frames.push({ kind: 'exit', value: current });
      for (const key of Reflect.ownKeys(current)) {
        if (isArray && key === 'length') continue;
        if (typeof key !== 'string')
          return 'projection contains a symbol property';
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
          return 'projection contains a non-data JSON property';
        if (
          isArray &&
          (!/^(?:0|[1-9]\d*)$/.test(key) || Number(key) >= current.length)
        )
          return 'projection contains a non-index array property';
        frames.push({
          depth: frame.depth + 1,
          kind: 'enter',
          value: descriptor.value,
        });
      }
    }
  } catch {
    return 'projection cannot be inspected as plain JSON';
  }

  return null;
}

const RawStorefrontPublicProjectionSchema = z
  .unknown()
  .transform((projection, context) => {
    const transportIssue = findJsonTransportIssue(projection);
    if (transportIssue) {
      context.addIssue({ code: 'custom', message: transportIssue });
      return z.NEVER;
    }

    try {
      const serialized = JSON.stringify(projection);
      if (serialized === undefined) {
        context.addIssue({
          code: 'custom',
          message: 'projection cannot be serialized as JSON',
        });
        return z.NEVER;
      }
      const serializedBytes = new TextEncoder().encode(serialized).byteLength;
      if (serializedBytes > MAX_NON_STREAMED_RPC_DTO_BYTES) {
        context.addIssue({
          code: 'custom',
          message: 'projection exceeds the 4 MiB RPC DTO limit',
        });
        return z.NEVER;
      }
      return JSON.parse(serialized) as unknown;
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'projection cannot be serialized as JSON',
      });
      return z.NEVER;
    }
  });

/** Bounded transport envelope for one coherent storefront publication snapshot. */
export const StorefrontPublicProjectionSchema =
  RawStorefrontPublicProjectionSchema.pipe(
    z.strictObject({
      schemaVersion: z.literal(1),
      merchantId: z.uuid(),
      publicationGeneration: z
        .number()
        .int()
        .nonnegative()
        .max(Number.MAX_SAFE_INTEGER),
      componentContractVersion: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      payload: StorefrontPublicProjectionPayloadSchema,
    })
  );

export type StorefrontPublicProjection = z.infer<
  typeof StorefrontPublicProjectionSchema
>;
