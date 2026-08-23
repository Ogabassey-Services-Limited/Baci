import { describe, expect, it } from 'vitest';
import { StorefrontPublicProjectionSchema } from './public-projection-schema';

const validProjection = {
  schemaVersion: 1,
  merchantId: '123e4567-e89b-42d3-a456-426614174000',
  publicationGeneration: 7,
  componentContractVersion: 'builder-components-v1',
  payload: {
    merchant: { name: 'Pilot Store', slug: 'pilot-store' },
    publishedConfig: { content: [], root: { props: {} } },
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

  it('rejects publication generations that cannot round-trip safely', () => {
    expect(
      StorefrontPublicProjectionSchema.safeParse({
        ...validProjection,
        publicationGeneration: Number.MAX_SAFE_INTEGER + 1,
      }).success
    ).toBe(false);
  });
});
