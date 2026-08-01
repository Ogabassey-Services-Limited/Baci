import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPostRequest,
  createVirtualTerminal,
  mockAdminFrom,
  mockFrom,
  mockRpc,
  POST,
  setupPostRouteTest,
} from './route.post.test-support';

describe('POST /api/paystack/virtual-terminal provider persistence', () => {
  beforeEach(setupPostRouteTest);

  it('rejects a cross-merchant staff assignment before creating a Paystack terminal', async () => {
    const assignmentChain: Record<string, unknown> = {};
    assignmentChain.select = vi.fn().mockReturnValue(assignmentChain);
    assignmentChain.eq = vi.fn().mockReturnValue(assignmentChain);
    assignmentChain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: null });
    mockAdminFrom.mockReturnValue(assignmentChain);

    const res = await POST(
      createPostRequest({
        name: 'Sales Terminal',
        staffId: '11111111-1111-4111-8111-111111111111',
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Staff member does not belong to this merchant',
    });
    expect(createVirtualTerminal).not.toHaveBeenCalled();
  });

  it('creates terminal successfully', async () => {
    const legacyUpdateChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'm-1' },
        error: null,
      }),
      select: vi.fn().mockReturnThis(),
    };
    const updateMock = vi.fn().mockReturnValue(legacyUpdateChain);
    const terminalInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'term-1' },
          error: null,
        }),
      }),
    });
    mockAdminFrom.mockReturnValue({ insert: terminalInsert });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') return { update: updateMock };
      return {};
    });
    vi.mocked(createVirtualTerminal).mockResolvedValue({
      success: true,
      data: {
        code: 'VT_TEST123',
        paymentMethods: [
          {
            type: 'dedicated_nuban',
            account_number: '1234567890',
            account_name: 'TEST BIZ',
            bank: 'Wema Bank',
          },
        ],
      },
    } as never);
    mockRpc.mockResolvedValue({ data: null, error: null });

    const res = await POST(createPostRequest({ name: 'Sales Terminal' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.terminal.code).toBe('VT_TEST123');
    expect(body.terminal.accountNumber).toBe('1234567890');
    expect(terminalInsert).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VT_TEST123', merchant_id: 'm-1' })
    );
    expect(mockRpc).toHaveBeenCalledWith('get_merchant_virtual_terminal_code', {
      p_merchant_id: 'm-1',
    });
    expect(updateMock).toHaveBeenCalledWith({
      virtual_terminal_code: 'VT_TEST123',
    });
  });

  it('returns 400 when Paystack API fails', async () => {
    mockAdminFrom.mockReturnValue({});
    vi.mocked(createVirtualTerminal).mockResolvedValue({
      success: false,
      error: 'Paystack rate limit exceeded',
      code: 'RATE_LIMIT',
    } as never);

    const res = await POST(createPostRequest({ name: 'Sales Terminal' }));

    expect(res.status).toBe(400);
  });
});
