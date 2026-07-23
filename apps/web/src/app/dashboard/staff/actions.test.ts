import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensurePermission: vi.fn(),
  sendEmail: vi.fn(),
  revalidatePath: vi.fn(),
  single: vi.fn(),
  insert: vi.fn(),
  updateEq: vi.fn(),
  update: vi.fn(),
  adminInsert: vi.fn(),
  createVirtualTerminal: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/merchant-server', () => ({
  ensurePermission: (...args: unknown[]) => mocks.ensurePermission(...args),
}));

vi.mock('next/headers', () => ({ cookies: () => Promise.resolve({}) }));
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
}));

// One builder that supports both the select→eq→eq→single read chain and the
// insert / update→eq write paths used by the staff actions.
function makeSupabase() {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.single = () => mocks.single();
  builder.insert = () => mocks.insert();
  builder.update = (payload: unknown) => {
    mocks.update(payload);
    const updateChain: Record<string, unknown> = {};
    updateChain.eq = () => updateChain;
    updateChain.select = () => ({ single: () => mocks.updateEq() });
    return updateChain;
  };
  return {
    from: () => builder,
    rpc: (...args: unknown[]) => mocks.rpc(...args),
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => makeSupabase(),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (...args: unknown[]) => mocks.adminInsert(...args),
    }),
  }),
}));

vi.mock('@/lib/paystack', () => ({
  createVirtualTerminal: (...args: unknown[]) =>
    mocks.createVirtualTerminal(...args),
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: (...args: unknown[]) => mocks.sendEmail(...args),
}));

vi.mock('@/lib/staff-invite-email', () => ({
  buildStaffInviteEmail: () => ({
    email: { to: 'x', subject: 's', htmlContent: 'h' },
    inviteUrl: 'https://app.test/staff/accept?token=tok-1',
  }),
}));

import {
  inviteStaffMember,
  removeStaffMember,
  resendInvitation,
  updateStaffMember,
} from './actions';

const validInvite = {
  email: 'new@example.com',
  name: 'New Person',
  role: 'sales_rep' as const,
  autoCreateAccount: false,
};

describe('inviteStaffMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensurePermission.mockResolvedValue({
      merchant: { id: 'm1', business_name: 'Shop' },
    });
    mocks.single.mockResolvedValue({ data: null }); // no existing staff
    mocks.insert.mockResolvedValue({ error: null });
  });

  it('reports success when the invite email is delivered', async () => {
    mocks.sendEmail.mockResolvedValue({ success: true });

    const result = await inviteStaffMember(validInvite);

    expect(result).toMatchObject({
      success: true,
      emailSent: true,
      message: 'Staff member invited successfully',
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/staff');
  });

  it('surfaces the shareable invite link when email delivery fails', async () => {
    mocks.sendEmail.mockResolvedValue({ success: false, error: 'smtp down' });

    const result = await inviteStaffMember(validInvite);

    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(false);
    expect(result.inviteUrl).toBe('https://app.test/staff/accept?token=tok-1');
    expect(result.message).toContain(
      'https://app.test/staff/accept?token=tok-1'
    );
  });

  it('persists an auto-created staff terminal with the admin client and sets the legacy code through the bounded RPC', async () => {
    mocks.sendEmail.mockResolvedValue({ success: true });
    mocks.single
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { id: 'staff-1' } });
    mocks.createVirtualTerminal.mockResolvedValue({
      success: true,
      data: {
        code: 'VT_STAFF1',
        paymentMethods: [
          {
            type: 'dedicated_nuban',
            account_number: '0123456789',
            account_name: 'NEW PERSON',
            bank: 'Test Bank',
          },
        ],
      },
    });
    mocks.adminInsert.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    await inviteStaffMember({ ...validInvite, autoCreateAccount: true });

    expect(mocks.adminInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VT_STAFF1',
        merchant_id: 'm1',
        staff_id: 'staff-1',
      })
    );
    // The secret `virtual_terminal_code` "set only when absent" write runs
    // through the bounded SECURITY DEFINER RPC on the authenticated client,
    // never a service-role client.
    expect(mocks.rpc).toHaveBeenCalledWith(
      'set_merchant_virtual_terminal_code_if_absent',
      { p_code: 'VT_STAFF1', p_merchant_id: 'm1' }
    );
  });
});

describe('resendInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensurePermission.mockResolvedValue({
      merchant: { id: 'm1', business_name: 'Shop' },
    });
    mocks.single.mockResolvedValue({
      data: {
        id: 's1',
        email: 'pending@example.com',
        name: 'Pending',
        role: 'sales_rep',
        status: 'pending',
      },
    });
    mocks.updateEq.mockResolvedValue({ error: null });
  });

  it('surfaces the shareable link when the resend email fails', async () => {
    mocks.sendEmail.mockResolvedValue({ success: false, error: 'smtp down' });

    const result = await resendInvitation('s1');

    expect(result.emailSent).toBe(false);
    expect(result.message).toContain(
      'https://app.test/staff/accept?token=tok-1'
    );
  });
});

describe('updateStaffMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensurePermission.mockResolvedValue({
      merchant: { id: 'm1', business_name: 'Shop' },
    });
    mocks.updateEq.mockResolvedValue({ data: { id: 's1' }, error: null });
  });

  it('clears user_id when status is changed to removed so future invitations can be accepted', async () => {
    const result = await updateStaffMember('s1', { status: 'removed' });

    expect(result).toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith({
      status: 'removed',
      user_id: null,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/staff');
  });
});

describe('removeStaffMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensurePermission.mockResolvedValue({
      merchant: { id: 'm1', business_name: 'Shop' },
    });
    mocks.updateEq.mockResolvedValue({ data: { id: 's1' }, error: null });
  });

  it('clears user_id when soft-removing staff so future invitations can be accepted', async () => {
    const result = await removeStaffMember('s1');

    expect(result).toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith({
      status: 'removed',
      user_id: null,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/staff');
  });
});
