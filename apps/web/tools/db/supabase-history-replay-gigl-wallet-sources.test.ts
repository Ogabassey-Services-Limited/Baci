import { describe, expect, it } from 'vitest';
import { GIGL_WALLET_SHIPPING_PENDING_SOURCES } from './supabase-history-replay-gigl-wallet-sources';

describe('GIGL wallet replay sources', () => {
  it('keeps every branch migration in the explicit pending registry input', () => {
    const migrations = GIGL_WALLET_SHIPPING_PENDING_SOURCES.split('\n');
    expect(migrations).toHaveLength(37);
    expect(migrations.at(-1)).toContain(
      '20260903136000_finalize_gigl_wallet_checkout_economics.sql'
    );
  });
});
