import { describe, expect, it } from 'vitest';
import { ogabasseyPdpLcpImageRequestSchema } from './ogabassey-pdp-lcp-image';

describe('ogabasseyPdpLcpImageRequestSchema', () => {
  it('normalizes valid product image preload inputs', () => {
    const result = ogabasseyPdpLcpImageRequestSchema.safeParse({
      productSlug: ' Dell-Alienware-M18-R3-RTX-5080 ',
      quality: '30',
      width: '750',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toEqual({
      productSlug: 'Dell-Alienware-M18-R3-RTX-5080',
      quality: 30,
      width: 750,
    });
  });

  it('defaults optional image transform parameters', () => {
    const result = ogabasseyPdpLcpImageRequestSchema.safeParse({
      productSlug: 'dell-alienware-m18-r3-rtx-5080',
      quality: null,
      width: null,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.quality).toBe(35);
    expect(result.data.width).toBe(750);
  });

  it('defaults empty and undefined image transform parameters', () => {
    const result = ogabasseyPdpLcpImageRequestSchema.safeParse({
      productSlug: 'dell-alienware-m18-r3-rtx-5080',
      quality: '',
      width: undefined,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.quality).toBe(35);
    expect(result.data.width).toBe(750);
  });

  it.each([
    ['19', false],
    ['20', true],
    ['90', true],
    ['91', false],
  ])('validates image quality boundary %s', (quality, expected) => {
    expect(
      ogabasseyPdpLcpImageRequestSchema.safeParse({
        productSlug: 'dell-alienware-m18-r3-rtx-5080',
        quality,
        width: '750',
      }).success
    ).toBe(expected);
  });

  it.each([
    ['127', false],
    ['128', true],
    ['3840', true],
    ['3841', false],
  ])('validates image width boundary %s', (width, expected) => {
    expect(
      ogabasseyPdpLcpImageRequestSchema.safeParse({
        productSlug: 'dell-alienware-m18-r3-rtx-5080',
        quality: '30',
        width,
      }).success
    ).toBe(expected);
  });

  it.each([
    ['30.5', '750'],
    [30.5, '750'],
    ['30', '750.1'],
    ['30', 750.1],
  ])('rejects non-integer transform values %#', (quality, width) => {
    expect(
      ogabasseyPdpLcpImageRequestSchema.safeParse({
        productSlug: 'dell-alienware-m18-r3-rtx-5080',
        quality,
        width,
      }).success
    ).toBe(false);
  });

  it('validates product slug shape and length rules', () => {
    expect(
      ogabasseyPdpLcpImageRequestSchema.safeParse({
        productSlug: '',
        quality: '30',
        width: '750',
      }).success
    ).toBe(false);
    expect(
      ogabasseyPdpLcpImageRequestSchema.safeParse({
        productSlug: '   ',
        quality: '30',
        width: '750',
      }).success
    ).toBe(false);
    expect(
      ogabasseyPdpLcpImageRequestSchema.safeParse({
        productSlug: 'a'.repeat(180),
        quality: '30',
        width: '750',
      }).success
    ).toBe(true);
    expect(
      ogabasseyPdpLcpImageRequestSchema.safeParse({
        productSlug: 'a'.repeat(181),
        quality: '30',
        width: '750',
      }).success
    ).toBe(false);
    expect(
      ogabasseyPdpLcpImageRequestSchema.safeParse({
        productSlug: 'product@name',
        quality: '30',
        width: '750',
      }).success
    ).toBe(false);
    expect(
      ogabasseyPdpLcpImageRequestSchema.safeParse({
        productSlug: 'product_name',
        quality: '30',
        width: '750',
      }).success
    ).toBe(false);
    expect(
      ogabasseyPdpLcpImageRequestSchema.safeParse({
        productSlug: 'product--name',
        quality: '30',
        width: '750',
      }).success
    ).toBe(false);
    expect(
      ogabasseyPdpLcpImageRequestSchema.safeParse({
        productSlug: 'product-name-',
        quality: '30',
        width: '750',
      }).success
    ).toBe(false);
  });

  it('rejects unsafe product slugs and out-of-range transforms', () => {
    expect(
      ogabasseyPdpLcpImageRequestSchema.safeParse({
        productSlug: '../secret',
        quality: '30',
        width: '750',
      }).success
    ).toBe(false);
    expect(
      ogabasseyPdpLcpImageRequestSchema.safeParse({
        productSlug: 'dell-alienware-m18-r3-rtx-5080',
        quality: '5',
        width: '750',
      }).success
    ).toBe(false);
    expect(
      ogabasseyPdpLcpImageRequestSchema.safeParse({
        productSlug: 'dell-alienware-m18-r3-rtx-5080',
        quality: '30',
        width: '99999',
      }).success
    ).toBe(false);
  });
});
