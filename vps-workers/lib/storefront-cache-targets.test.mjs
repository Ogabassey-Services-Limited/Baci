import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildStorefrontCacheTargets } from './storefront-cache-targets.mjs';

describe('buildStorefrontCacheTargets', () => {
  it('builds tenant data, exact product, and HTML response tags', () => {
    const result = buildStorefrontCacheTargets(
      {
        merchant_id: '22222222-2222-4222-8222-222222222222',
        product_slugs: ['cache-phone'],
        related_identifiers: ['shop-one', 'shop.example.com'],
        target_id: 'shop-one',
        target_kind: 'storefront_slug',
      },
      'usebaci.com'
    );

    assert.ok(
      result.tags.includes('products-22222222-2222-4222-8222-222222222222')
    );
    assert.ok(
      result.tags.includes(
        'product-22222222-2222-4222-8222-222222222222-cache-phone'
      )
    );
    assert.ok(result.tags.includes('ps:shop-one'));
    assert.ok(result.tags.includes('ph:shop.example.com'));
    assert.deepEqual(result.hostnames.sort(), [
      'shop-one.usebaci.com',
      'shop.example.com',
      'www.shop.example.com',
    ]);
  });

  it('hashes an unsafe product tag within the Vercel limit', () => {
    const result = buildStorefrontCacheTargets(
      {
        merchant_id: 'merchant-id',
        product_slugs: ['Phone / 256 GB'],
        related_identifiers: ['shop'],
        target_id: 'shop',
        target_kind: 'storefront_slug',
      },
      'usebaci.com'
    );
    const tag = result.tags.find((value) =>
      value.startsWith('product-merchant-id-phone-256-gb-')
    );
    assert.ok(tag);
    assert.ok(Buffer.byteLength(tag) <= 256);
  });

  it('normalizes merchant IDs and excludes invalid provider targets', () => {
    const result = buildStorefrontCacheTargets(
      {
        merchant_id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
        product_slugs: ['cache-phone'],
        related_identifiers: [
          'safe-shop',
          'bad,tag',
          'bad,.example.com',
          'shop.example.com',
        ],
        target_id: 'safe-shop',
        target_kind: 'storefront_slug',
      },
      'usebaci.com'
    );

    assert.ok(
      result.tags.includes('merchant-id-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    );
    assert.ok(result.tags.includes('ps:safe-shop'));
    assert.ok(result.tags.includes('ph:shop.example.com'));
    assert.ok(result.tags.every((tag) => !tag.includes(',')));
    assert.ok(result.hostnames.every((hostname) => !hostname.includes(',')));
  });
});
