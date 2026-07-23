import { describe, expect, it, vi } from 'vitest';
import { resolveMcpPaystackDvaAccess } from './mcp-paystack-dva-access';

const storedDva = {
  account_name: 'Test Buyer',
  account_number: '1234567890',
  bank_name: 'Test Bank',
};

describe('resolveMcpPaystackDvaAccess', () => {
  it('enables creation and complete stored-DVA disclosure only when enabled', () => {
    const access = resolveMcpPaystackDvaAccess(
      { AGENTIC_PAYSTACK_DVA_MODE: 'enabled', NODE_ENV: 'production' },
      vi.fn()
    );

    expect(access.toolEnabled).toBe(true);
    expect(access.getDisclosableStoredDva(storedDva)).toEqual({
      accountName: 'Test Buyer',
      accountNumber: '1234567890',
      bankName: 'Test Bank',
    });
    expect(
      access.getDisclosableStoredDva({ account_number: '1234567890' })
    ).toBeNull();
  });

  it.each(['paused', 'invalid'])(
    'redacts stored DVA details and disables creation in %s mode',
    (mode) => {
      const access = resolveMcpPaystackDvaAccess(
        { AGENTIC_PAYSTACK_DVA_MODE: mode, NODE_ENV: 'production' },
        vi.fn()
      );

      expect(access.toolEnabled).toBe(false);
      expect(access.getDisclosableStoredDva(storedDva)).toBeNull();
    }
  );
});
