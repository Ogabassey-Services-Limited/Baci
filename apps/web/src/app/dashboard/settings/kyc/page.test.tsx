import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockConnection = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock('next/server', () => ({
  connection: () => mockConnection(),
}));

vi.mock('@/lib/merchant-server', () => ({
  getMerchantForUser: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('./kyc-verification', async () => {
  const { useState } = await import('react');

  return {
    KycVerification: ({ merchantId }: { merchantId: string }) => {
      const [draft, setDraft] = useState('');

      return (
        <input
          aria-label="KYC draft"
          data-merchant-id={merchantId}
          data-testid="kyc-verification"
          onChange={(event) => setDraft(event.target.value)}
          value={draft}
        />
      );
    },
  };
});

import { cookies } from 'next/headers';
import { getMerchantForUser } from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';
import KycSettingsPage from './page';

describe('KycSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnection.mockResolvedValue(undefined);
    vi.mocked(cookies).mockResolvedValue({} as never);
  });

  it('does not render identity verification forms for India merchants', async () => {
    vi.mocked(getMerchantForUser).mockResolvedValue({
      merchant: { id: 'merchant-1', country: 'IN' },
      staffAccess: { isOwner: true },
    } as never);

    render(await KycSettingsPage());

    expect(
      screen.getByRole('heading', { name: /verification not required/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/nigerian kyc/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/bvn|nin|cac/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('kyc-verification')).not.toBeInTheDocument();
    expect(cookies).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(mockConnection).toHaveBeenCalledOnce();
  });

  it('renders Nigerian KYC forms for Nigeria merchants', async () => {
    vi.mocked(getMerchantForUser).mockResolvedValue({
      merchant: {
        id: 'merchant-1',
        country: 'NG',
        nin: null,
        bvn: null,
        cac_rc_number: null,
        phone: null,
      },
      staffAccess: { isOwner: true },
    } as never);
    vi.mocked(createClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as never);

    render(await KycSettingsPage());

    expect(screen.getByTestId('kyc-verification')).toBeInTheDocument();
    expect(mockConnection).toHaveBeenCalledOnce();
  });

  it('remounts the KYC form when the active merchant changes', async () => {
    const user = userEvent.setup();
    vi.mocked(getMerchantForUser)
      .mockResolvedValueOnce({
        merchant: {
          id: 'merchant-a',
          country: 'NG',
          nin: null,
          bvn: null,
          cac_rc_number: null,
          phone: null,
        },
        staffAccess: { isOwner: true },
      } as never)
      .mockResolvedValueOnce({
        merchant: {
          id: 'merchant-b',
          country: 'NG',
          nin: null,
          bvn: null,
          cac_rc_number: null,
          phone: null,
        },
        staffAccess: { isOwner: true },
      } as never);
    vi.mocked(createClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as never);

    const { rerender } = render(await KycSettingsPage());
    const form = screen.getByTestId('kyc-verification');
    await user.type(form, 'draft for merchant A');

    rerender(await KycSettingsPage());

    expect(screen.getByTestId('kyc-verification')).toHaveAttribute(
      'data-merchant-id',
      'merchant-b'
    );
    expect(screen.getByRole('textbox', { name: 'KYC draft' })).toHaveValue('');
  });
});
