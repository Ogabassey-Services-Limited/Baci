import { describe, expect, it } from 'vitest';
import { selectJumiaOrderSyncIntegrations } from './select-jumia-order-sync-integrations';

describe('bugfix: disabled sibling claims order-sync scope', () => {
  it('selects a later enabled integration when an earlier sibling has orders disabled', () => {
    const selected = selectJumiaOrderSyncIntegrations([
      {
        id: 'disabled-first',
        merchant_id: 'merchant-1',
        shop_id: 'shop-1',
        country_code: 'NG',
        last_sync_at: null,
        sync_config: { orders: false },
      },
      {
        id: 'enabled-second',
        merchant_id: 'merchant-1',
        shop_id: 'shop-1',
        country_code: 'NG',
        last_sync_at: null,
        sync_config: { orders: true },
      },
    ]);

    expect(selected.map((row) => row.id)).toEqual(['enabled-second']);
  });

  it('keeps one enabled integration per shop+country+marketplace scope', () => {
    const selected = selectJumiaOrderSyncIntegrations([
      {
        id: 'enabled-first',
        merchant_id: 'merchant-1',
        shop_id: 'shop-1',
        country_code: 'NG',
        last_sync_at: null,
        sync_config: { orders: true },
      },
      {
        id: 'enabled-duplicate',
        merchant_id: 'merchant-1',
        shop_id: 'shop-1',
        country_code: 'NG',
        last_sync_at: null,
        sync_config: { orders: true },
      },
    ]);

    expect(selected.map((row) => row.id)).toEqual(['enabled-first']);
  });

  it('deduplicates same-grant business clients the Orders API cannot scope', () => {
    const selected = selectJumiaOrderSyncIntegrations([
      {
        id: 'retail',
        merchant_id: 'merchant-1',
        shop_id: 'shop-1',
        country_code: 'NG',
        marketplace_key: 'NG-RETAIL',
        jumia_authorization_id: 'authorization-1',
        last_sync_at: null,
        sync_config: { orders: true },
      },
      {
        id: 'express',
        merchant_id: 'merchant-1',
        shop_id: 'shop-1',
        country_code: 'NG',
        marketplace_key: 'NG-EXPRESS',
        jumia_authorization_id: 'authorization-1',
        last_sync_at: null,
        sync_config: { orders: true },
      },
    ]);

    expect(selected.map((row) => row.id)).toEqual(['retail']);
  });

  it('keeps integrations backed by distinct self-authorization grants separate', () => {
    const selected = selectJumiaOrderSyncIntegrations([
      {
        id: 'grant-a',
        merchant_id: 'merchant-1',
        shop_id: 'shop-1',
        country_code: 'NG',
        marketplace_key: 'NG-RETAIL',
        jumia_authorization_id: 'authorization-a',
        last_sync_at: null,
        sync_config: { orders: true },
      },
      {
        id: 'grant-b',
        merchant_id: 'merchant-1',
        shop_id: 'shop-1',
        country_code: 'NG',
        marketplace_key: 'NG-RETAIL',
        jumia_authorization_id: 'authorization-b',
        last_sync_at: null,
        sync_config: { orders: true },
      },
    ]);

    expect(selected.map((row) => row.id)).toEqual(['grant-a', 'grant-b']);
  });
});
