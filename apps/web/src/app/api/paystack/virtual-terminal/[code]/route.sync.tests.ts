import { beforeEach, describe, expect, it } from 'vitest';
import {
  createMerchantLookup,
  createParams,
  createRequest,
  DELETE,
  MERCHANT_ID,
  mockAdminRpc,
  mockDeactivateVirtualTerminal,
  mockFrom,
  mockGetMerchantForApiRequest,
  mockRpc,
  mockUpdateVirtualTerminal,
  PUT,
  setupDetailRouteTest,
  TERMINAL_CODE,
} from './route.test-support';

describe('/api/paystack/virtual-terminal/[code] provider sync', () => {
  beforeEach(setupDetailRouteTest);

  it('syncs Paystack account details through the server-only RPC after rename', async () => {
    const terminalLookup = createMerchantLookup(null);
    terminalLookup.maybeSingle.mockResolvedValue({
      data: { id: 'terminal-1' },
      error: null,
    });
    mockFrom.mockReturnValue(terminalLookup);
    mockUpdateVirtualTerminal.mockResolvedValue({
      data: {
        code: TERMINAL_CODE,
        paymentMethods: [
          {
            account_name: 'Test Store',
            account_number: '1234567890',
            bank: 'Test Bank',
            type: 'dedicated_nuban',
          },
        ],
      },
      success: true,
    });

    const response = await PUT(
      createRequest('PUT', { name: 'Sales Terminal' }),
      createParams()
    );

    expect(response.status).toBe(200);
    expect(mockAdminRpc).toHaveBeenCalledWith('sync_virtual_terminal_local', {
      p_account_name: 'Test Store',
      p_account_number: '1234567890',
      p_active: null,
      p_bank: 'Test Bank',
      p_code: TERMINAL_CODE,
      p_merchant_id: MERCHANT_ID,
      p_name: 'Sales Terminal',
    });
  });

  it('preserves provider-confirmed account details during staff sync', async () => {
    const terminalLookup = createMerchantLookup(null);
    terminalLookup.maybeSingle.mockResolvedValue({
      data: { id: 'terminal-1' },
      error: null,
    });
    mockFrom.mockReturnValue(terminalLookup);
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: MERCHANT_ID,
      staffAccess: {
        isOwner: false,
        isStaff: true,
        role: 'manager',
        permissions: { integrations: { manage: true } },
      },
    });
    mockUpdateVirtualTerminal.mockResolvedValue({
      data: {
        code: TERMINAL_CODE,
        paymentMethods: [
          {
            account_name: 'Test Store',
            account_number: '1234567890',
            bank: 'Test Bank',
            type: 'dedicated_nuban',
          },
        ],
      },
      success: true,
    });

    const response = await PUT(
      createRequest('PUT', { name: 'Sales Terminal' }),
      createParams()
    );

    expect(response.status).toBe(200);
    expect(mockAdminRpc).toHaveBeenCalledWith('sync_virtual_terminal_local', {
      p_account_name: 'Test Store',
      p_account_number: '1234567890',
      p_active: null,
      p_bank: 'Test Bank',
      p_code: TERMINAL_CODE,
      p_merchant_id: MERCHANT_ID,
      p_name: 'Sales Terminal',
    });
  });

  it('deactivates a terminal and clears the legacy code through the bounded RPC on the authenticated client', async () => {
    const terminalLookup = createMerchantLookup(null);
    terminalLookup.maybeSingle.mockResolvedValue({
      data: { id: 'terminal-1' },
      error: null,
    });
    mockFrom.mockReturnValue(terminalLookup);
    mockDeactivateVirtualTerminal.mockResolvedValue({
      data: { code: TERMINAL_CODE },
      success: true,
    });
    mockRpc.mockResolvedValue({ data: null, error: null });

    const response = await DELETE(createRequest('DELETE'), createParams());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: 'Virtual Terminal deactivated',
    });
    expect(mockRpc).toHaveBeenCalledWith(
      'clear_merchant_virtual_terminal_code',
      {
        p_code: TERMINAL_CODE,
        p_merchant_id: MERCHANT_ID,
      }
    );
    expect(mockFrom).not.toHaveBeenCalledWith('merchants');
  });

  it('syncs a rename when the Paystack response omits paymentMethods', async () => {
    const terminalLookup = createMerchantLookup(null);
    terminalLookup.maybeSingle.mockResolvedValue({
      data: { id: 'terminal-1' },
      error: null,
    });
    mockFrom.mockReturnValue(terminalLookup);
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: MERCHANT_ID,
      staffAccess: {
        isOwner: true,
        isStaff: false,
        role: null,
        permissions: { integrations: { manage: true } },
      },
    });
    mockUpdateVirtualTerminal.mockResolvedValue({
      data: { code: TERMINAL_CODE },
      success: true,
    });

    const response = await PUT(
      createRequest('PUT', { name: 'Sales Terminal' }),
      createParams()
    );

    expect(response.status).toBe(200);
    expect(mockAdminRpc).toHaveBeenCalledWith('sync_virtual_terminal_local', {
      p_account_name: null,
      p_account_number: null,
      p_active: null,
      p_bank: null,
      p_code: TERMINAL_CODE,
      p_merchant_id: MERCHANT_ID,
      p_name: 'Sales Terminal',
    });
  });
});
