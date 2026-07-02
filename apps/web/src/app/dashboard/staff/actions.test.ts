import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensurePermission: vi.fn(),
  sendEmail: vi.fn(),
  revalidatePath: vi.fn(),
  single: vi.fn(),
  insert: vi.fn(),
  updateEq: vi.fn(),
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
  builder.update = () => ({ eq: () => mocks.updateEq() });
  return { from: () => builder };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => makeSupabase(),
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: (...args: unknown[]) => mocks.sendEmail(...args),
}));

vi.mock('@/lib/staff-invite-email', () => ({
  buildStaffInviteEmail: () => ({
    email: { to: 'x', subject: 's', htmlContent: 'h' },
    inviteUrl: 'https://app.test/staff/accept?token=tok-1',
  }),
}));

import { inviteStaffMember, resendInvitation } from './actions';

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
