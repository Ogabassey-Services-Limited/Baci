import { describe, expect, it } from 'vitest';
import { StorefrontPublicProjectionSchema } from './public-projection-schema';

const validProjection = {
  schemaVersion: 1,
  merchantId: '123e4567-e89b-42d3-a456-426614174000',
  publicationGeneration: 7,
  componentContractVersion: 'builder-components-v1',
  payload: {
    merchant: { name: 'Pilot Store', slug: 'pilot-store' },
    publishedConfig: { content: [], root: { props: { title: 'Home' } } },
    products: [],
  },
} as const;

describe('StorefrontPublicProjectionSchema', () => {
  it('accepts a strict versioned JSON projection envelope', () => {
    expect(StorefrontPublicProjectionSchema.parse(validProjection)).toEqual(
      validProjection
    );
  });

  it('rejects unknown envelope fields', () => {
    expect(
      StorefrontPublicProjectionSchema.safeParse({
        ...validProjection,
        serviceRoleKey: 'must-never-cross-the-release-boundary',
      }).success
    ).toBe(false);
  });

  it('rejects non-JSON values in the projection payload', () => {
    expect(
      StorefrontPublicProjectionSchema.safeParse({
        ...validProjection,
        payload: { render: () => 'not a transport value' },
      }).success
    ).toBe(false);
  });

  it('rejects private data hidden inside the public payload', () => {
    expect(
      StorefrontPublicProjectionSchema.safeParse({
        ...validProjection,
        payload: {
          ...validProjection.payload,
          customer: { email: 'shopper@example.com' },
          draftConfig: { content: [] },
          serviceRoleKey: 'must-never-cross-the-release-boundary',
        },
      }).success
    ).toBe(false);
  });

  it('rejects a non-streamed projection larger than 4 MiB', () => {
    const oversizedProjection = {
      ...validProjection,
      payload: { content: 'x'.repeat(4_194_304) },
    };

    const result =
      StorefrontPublicProjectionSchema.safeParse(oversizedProjection);

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'projection exceeds the 4 MiB RPC DTO limit',
          }),
        ])
      );
  });

  it('measures the raw DTO before component-version normalization', () => {
    const oversizedProjection = {
      ...validProjection,
      componentContractVersion: `${' '.repeat(4_194_304)}v1`,
    };

    const result =
      StorefrontPublicProjectionSchema.safeParse(oversizedProjection);

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'projection exceeds the 4 MiB RPC DTO limit',
          }),
        ])
      );
  });

  it('returns a validation failure for deeply nested JSON without throwing', () => {
    let deeplyNestedPayload: unknown = null;
    for (let depth = 0; depth < 5_000; depth += 1)
      deeplyNestedPayload = [deeplyNestedPayload];
    const deeplyNestedProjection = {
      ...validProjection,
      payload: deeplyNestedPayload,
    };

    expect(() =>
      StorefrontPublicProjectionSchema.safeParse(deeplyNestedProjection)
    ).not.toThrow();
    expect(
      StorefrontPublicProjectionSchema.safeParse(deeplyNestedProjection).success
    ).toBe(false);
  });

  it('returns a validation failure for cyclic payloads without throwing', () => {
    const cyclicPayload: { self?: unknown } = {};
    cyclicPayload.self = cyclicPayload;
    const cyclicProjection = { ...validProjection, payload: cyclicPayload };

    expect(() =>
      StorefrontPublicProjectionSchema.safeParse(cyclicProjection)
    ).not.toThrow();
    expect(
      StorefrontPublicProjectionSchema.safeParse(cyclicProjection).success
    ).toBe(false);
  });

  it('rejects shared object graphs without expanding every reference path', () => {
    let sharedPayload: unknown = { leaf: true };
    for (let depth = 0; depth < 24; depth += 1)
      sharedPayload = { left: sharedPayload, right: sharedPayload };
    const sharedProjection = { ...validProjection, payload: sharedPayload };

    const result = StorefrontPublicProjectionSchema.safeParse(sharedProjection);

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'projection contains a shared JSON reference',
          }),
        ])
      );
  });

  it('returns a validation failure when serialization invokes a throwing proxy', () => {
    const capabilityBearingPayload = new Proxy(
      { ...validProjection.payload },
      {
        get(target, property, receiver) {
          if (property === 'toJSON') throw new Error('capability invoked');
          return Reflect.get(target, property, receiver);
        },
      }
    );
    const proxyProjection = {
      ...validProjection,
      payload: capabilityBearingPayload,
    };

    expect(() =>
      StorefrontPublicProjectionSchema.safeParse(proxyProjection)
    ).not.toThrow();
    expect(
      StorefrontPublicProjectionSchema.safeParse(proxyProjection).success
    ).toBe(false);
  });

  it('rejects publication generations that cannot round-trip safely', () => {
    expect(
      StorefrontPublicProjectionSchema.safeParse({
        ...validProjection,
        publicationGeneration: Number.MAX_SAFE_INTEGER + 1,
      }).success
    ).toBe(false);
  });
});
