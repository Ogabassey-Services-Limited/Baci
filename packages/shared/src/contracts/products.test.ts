import { describe, expect, it } from 'vitest';
import {
  MOBILE_ADMIN_PRODUCT_COLUMNS,
  MOBILE_ADMIN_PRODUCT_WITH_RELATIONS_QUERY,
  WEB_PRODUCT_COLUMNS,
  WEB_PRODUCT_VARIANT_COLUMNS,
  WEB_PRODUCT_WITH_VARIANTS_QUERY,
} from './products';

describe('product column constants', () => {
  it('MOBILE_ADMIN_PRODUCT_COLUMNS is a non-empty string', () => {
    expect(typeof MOBILE_ADMIN_PRODUCT_COLUMNS).toBe('string');
    expect(MOBILE_ADMIN_PRODUCT_COLUMNS.length).toBeGreaterThan(0);
  });

  it('WEB_PRODUCT_COLUMNS is a non-empty string', () => {
    expect(typeof WEB_PRODUCT_COLUMNS).toBe('string');
    expect(WEB_PRODUCT_COLUMNS.length).toBeGreaterThan(0);
  });

  it('WEB_PRODUCT_VARIANT_COLUMNS is a non-empty string', () => {
    expect(typeof WEB_PRODUCT_VARIANT_COLUMNS).toBe('string');
    expect(WEB_PRODUCT_VARIANT_COLUMNS.length).toBeGreaterThan(0);
  });

  it('no constant contains select(*)', () => {
    const allConstants = [
      MOBILE_ADMIN_PRODUCT_COLUMNS,
      MOBILE_ADMIN_PRODUCT_WITH_RELATIONS_QUERY,
      WEB_PRODUCT_COLUMNS,
      WEB_PRODUCT_VARIANT_COLUMNS,
      WEB_PRODUCT_WITH_VARIANTS_QUERY,
    ];
    for (const col of allConstants) {
      expect(col).not.toContain('*');
    }
  });

  it('MOBILE_ADMIN_PRODUCT_WITH_RELATIONS_QUERY includes base columns and relations', () => {
    expect(MOBILE_ADMIN_PRODUCT_WITH_RELATIONS_QUERY).toContain(
      MOBILE_ADMIN_PRODUCT_COLUMNS
    );
    expect(MOBILE_ADMIN_PRODUCT_WITH_RELATIONS_QUERY).toContain(
      'categories(name)'
    );
    expect(MOBILE_ADMIN_PRODUCT_WITH_RELATIONS_QUERY).toContain('brands(name)');
  });

  it('WEB_PRODUCT_WITH_VARIANTS_QUERY includes base columns and variant columns', () => {
    expect(WEB_PRODUCT_WITH_VARIANTS_QUERY).toContain(WEB_PRODUCT_COLUMNS);
    expect(WEB_PRODUCT_WITH_VARIANTS_QUERY).toContain(
      'variants:product_variants('
    );
    expect(WEB_PRODUCT_WITH_VARIANTS_QUERY).toContain(
      WEB_PRODUCT_VARIANT_COLUMNS
    );
  });

  it('MOBILE_ADMIN_PRODUCT_COLUMNS includes essential product fields', () => {
    const essentialFields = [
      'id',
      'name',
      'price',
      'stock_quantity',
      'status',
      'images',
    ];
    for (const field of essentialFields) {
      expect(MOBILE_ADMIN_PRODUCT_COLUMNS).toContain(field);
    }
  });

  it('WEB_PRODUCT_COLUMNS includes SEO fields', () => {
    const seoFields = [
      'meta_title',
      'meta_description',
      'canonical_url',
      'schema_markup',
    ];
    for (const field of seoFields) {
      expect(WEB_PRODUCT_COLUMNS).toContain(field);
    }
  });
});
