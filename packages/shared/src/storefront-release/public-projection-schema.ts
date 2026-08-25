import { z } from 'zod';
import { StorefrontPublicProjectionPayloadSchema } from './public-projection-payload-schema';

const MAX_NON_STREAMED_RPC_DTO_BYTES = 4_194_304;
const MAX_JSON_NESTING_DEPTH = 64;

type JsonSnapshotResult =
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{ message: string; ok: false }>;

function createDetachedJsonSnapshot(value: unknown): JsonSnapshotResult {
  const seen = new WeakSet<object>();
  const clone = (current: unknown, depth: number): JsonSnapshotResult => {
    try {
      if (
        current === null ||
        typeof current === 'string' ||
        typeof current === 'boolean'
      )
        return { ok: true, value: current };
      if (typeof current === 'number') {
        if (!Number.isFinite(current))
          return {
            message: 'projection contains a non-JSON number',
            ok: false,
          };
        return { ok: true, value: current };
      }
      if (typeof current !== 'object')
        return { message: 'projection contains a non-JSON value', ok: false };
      if (depth > MAX_JSON_NESTING_DEPTH)
        return {
          message: 'projection exceeds the maximum JSON nesting depth',
          ok: false,
        };
      if (seen.has(current))
        return {
          message: 'projection contains a shared JSON reference',
          ok: false,
        };

      const isArray = Array.isArray(current);
      const prototype = Object.getPrototypeOf(current);
      if (
        (isArray && prototype !== Array.prototype) ||
        (!isArray && prototype !== Object.prototype && prototype !== null)
      )
        return {
          message: 'projection contains a non-plain JSON object',
          ok: false,
        };

      seen.add(current);
      const snapshot: unknown[] | Record<string, unknown> = isArray ? [] : {};
      const arrayLengthDescriptor = isArray
        ? Object.getOwnPropertyDescriptor(current, 'length')
        : undefined;
      if (
        isArray &&
        (!arrayLengthDescriptor || !('value' in arrayLengthDescriptor))
      )
        return {
          message: 'projection contains a non-data JSON property',
          ok: false,
        };
      const arrayLength = isArray ? Number(arrayLengthDescriptor?.value) : 0;
      if (
        isArray &&
        (arrayLength < 0 ||
          !Number.isSafeInteger(arrayLength) ||
          (arrayLength > 0 &&
            arrayLength * 2 + 1 > MAX_NON_STREAMED_RPC_DTO_BYTES))
      )
        return {
          message: 'projection array cannot fit within the 4 MiB RPC DTO limit',
          ok: false,
        };
      if (isArray) (snapshot as unknown[]).length = arrayLength;

      for (const key of Reflect.ownKeys(current)) {
        if (isArray && key === 'length') continue;
        if (typeof key !== 'string')
          return {
            message: 'projection contains a symbol property',
            ok: false,
          };
        if (key === '__proto__')
          return {
            message: 'projection contains a reserved JSON property',
            ok: false,
          };
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
          return {
            message: 'projection contains a non-data JSON property',
            ok: false,
          };
        if (
          isArray &&
          (!/^(?:0|[1-9]\d*)$/.test(key) || Number(key) >= arrayLength)
        )
          return {
            message: 'projection contains a non-index array property',
            ok: false,
          };
        const child = clone(descriptor.value, depth + 1);
        if (!child.ok) return child;
        if (isArray) (snapshot as unknown[])[Number(key)] = child.value;
        else
          Object.defineProperty(snapshot, key, {
            configurable: true,
            enumerable: true,
            value: child.value,
            writable: true,
          });
      }
      return { ok: true, value: snapshot };
    } catch {
      return {
        message: 'projection cannot be inspected as plain JSON',
        ok: false,
      };
    }
  };

  return clone(value, 0);
}

const RawStorefrontPublicProjectionSchema = z
  .unknown()
  .transform((projection, context) => {
    const snapshot = createDetachedJsonSnapshot(projection);
    if (!snapshot.ok) {
      context.addIssue({ code: 'custom', message: snapshot.message });
      return z.NEVER;
    }

    try {
      const serialized = JSON.stringify(snapshot.value);
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
      return snapshot.value;
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
    z
      .strictObject({
        schemaVersion: z.literal(1),
        merchantId: z.uuid(),
        publicationGeneration: z
          .string()
          .regex(/^[1-9][0-9]*$/)
          .refine(
            (value) => BigInt(value) <= 9_223_372_036_854_775_807n,
            'Expected a positive PostgreSQL bigint decimal'
          ),
        componentContractVersion: z.literal('builder-components-v1'),
        payload: StorefrontPublicProjectionPayloadSchema,
      })
      .superRefine((projection, context) => {
        if (projection.payload.merchant.id !== projection.merchantId)
          context.addIssue({
            code: 'custom',
            message: 'Payload merchant identity must match the envelope',
            path: ['payload', 'merchant', 'id'],
          });
        const serializedBytes = new TextEncoder().encode(
          JSON.stringify(projection)
        ).byteLength;
        if (serializedBytes > MAX_NON_STREAMED_RPC_DTO_BYTES)
          context.addIssue({
            code: 'custom',
            message: 'projection exceeds the 4 MiB RPC DTO limit',
          });
      })
  );

export type StorefrontPublicProjection = z.infer<
  typeof StorefrontPublicProjectionSchema
>;
