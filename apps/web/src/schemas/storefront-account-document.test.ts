import { describe, expect, it } from 'vitest';
import {
  storefrontAccountDocumentParamsSchema,
  storefrontAccountDocumentQuerySchema,
} from '@/schemas/storefront-account-document';

describe('storefrontAccountDocumentParamsSchema', () => {
  it('accepts a valid account order id', () => {
    expect(
      storefrontAccountDocumentParamsSchema.safeParse({
        id: 'cfa945fc-9bf4-4485-857c-4d4374adf31f',
      }).success
    ).toBe(true);
  });

  it('rejects invalid account order ids', () => {
    expect(
      storefrontAccountDocumentParamsSchema.safeParse({ id: 'not-a-uuid' })
        .success
    ).toBe(false);
    expect(storefrontAccountDocumentParamsSchema.safeParse({}).success).toBe(
      false
    );
    expect(
      storefrontAccountDocumentParamsSchema.safeParse({
        id: '12345678-1234-1234-1234-12345678901',
      }).success
    ).toBe(false);
    expect(
      storefrontAccountDocumentParamsSchema.safeParse({
        id: 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz',
      }).success
    ).toBe(false);
    expect(
      storefrontAccountDocumentParamsSchema.safeParse({ id: null }).success
    ).toBe(false);
  });
});

describe('storefrontAccountDocumentQuerySchema', () => {
  it('accepts a valid merchant slug', () => {
    expect(
      storefrontAccountDocumentQuerySchema.safeParse({
        merchantSlug: 'ogabassey',
      }).success
    ).toBe(true);
  });

  it('rejects blank or missing merchant slugs', () => {
    expect(
      storefrontAccountDocumentQuerySchema.safeParse({
        merchantSlug: '',
      }).success
    ).toBe(false);
    expect(
      storefrontAccountDocumentQuerySchema.safeParse({
        merchantSlug: '   ',
      }).success
    ).toBe(false);
    expect(
      storefrontAccountDocumentQuerySchema.safeParse({
        merchantSlug: null,
      }).success
    ).toBe(false);
    expect(storefrontAccountDocumentQuerySchema.safeParse({}).success).toBe(
      false
    );
  });

  it('accepts valid slug shapes and rejects unsupported characters', () => {
    expect(
      storefrontAccountDocumentQuerySchema.safeParse({
        merchantSlug: 'merchant123',
      }).success
    ).toBe(true);
    expect(
      storefrontAccountDocumentQuerySchema.safeParse({
        merchantSlug: 'merchant-name',
      }).success
    ).toBe(true);
    expect(
      storefrontAccountDocumentQuerySchema.safeParse({
        merchantSlug: 'merchant-name-2',
      }).success
    ).toBe(true);
    expect(
      storefrontAccountDocumentQuerySchema.safeParse({
        merchantSlug: 'test@slug',
      }).success
    ).toBe(false);
    expect(
      storefrontAccountDocumentQuerySchema.safeParse({
        merchantSlug: 'test slug',
      }).success
    ).toBe(false);
    expect(
      storefrontAccountDocumentQuerySchema.safeParse({
        merchantSlug: 'merchant_name',
      }).success
    ).toBe(false);
    expect(
      storefrontAccountDocumentQuerySchema.safeParse({
        merchantSlug: '-merchant',
      }).success
    ).toBe(false);
    expect(
      storefrontAccountDocumentQuerySchema.safeParse({
        merchantSlug: 'merchant-',
      }).success
    ).toBe(false);
    expect(
      storefrontAccountDocumentQuerySchema.safeParse({
        merchantSlug: 'merchant--name',
      }).success
    ).toBe(false);
  });

  it('rejects merchant slugs longer than the schema limit', () => {
    expect(
      storefrontAccountDocumentQuerySchema.safeParse({
        merchantSlug: 'a'.repeat(100),
      }).success
    ).toBe(true);
    expect(
      storefrontAccountDocumentQuerySchema.safeParse({
        merchantSlug: 'a'.repeat(101),
      }).success
    ).toBe(false);
  });
});
