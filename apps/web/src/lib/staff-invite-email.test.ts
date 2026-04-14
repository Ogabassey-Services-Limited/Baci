import { describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getAppUrl: () => 'https://usebaci.com',
}));

import { buildStaffInviteEmail } from '@/lib/staff-invite-email';

describe('buildStaffInviteEmail', () => {
  it('builds the canonical invite URL and email payload', () => {
    const result = buildStaffInviteEmail({
      businessName: 'TGW Enterprise',
      role: 'sales_rep',
      to: 'staff@example.com',
      toName: 'Wonder',
      token: 'token-123',
    });

    expect(result.inviteUrl).toBe('https://usebaci.com/invite/token-123');
    expect(result.email.to).toBe('staff@example.com');
    expect(result.email.subject).toBe(
      "You've been invited to join TGW Enterprise"
    );
    expect(result.email.htmlContent).toContain(
      'https://usebaci.com/invite/token-123'
    );
    expect(result.email.textContent).toContain('sales rep');
  });

  it('escapes user-controlled HTML in the email body', () => {
    const result = buildStaffInviteEmail({
      businessName: 'TGW <Store>',
      role: 'sales_rep',
      to: 'staff@example.com',
      toName: 'Wonder <script>alert(1)</script>',
      token: 'token-123',
    });

    expect(result.email.htmlContent).toContain('TGW &lt;Store&gt;');
    expect(result.email.htmlContent).toContain(
      'Wonder &lt;script&gt;alert(1)&lt;/script&gt;'
    );
    expect(result.email.htmlContent).not.toContain('<script>alert(1)</script>');
  });
});
