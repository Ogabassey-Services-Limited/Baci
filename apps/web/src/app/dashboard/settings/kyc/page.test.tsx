import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock('@/lib/merchant-server', () => ({
  getMerchantForUser: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('./kyc-verification', () => ({
  KycVerification: () => <div data-testid="kyc-verification" />,
}));

import { cookies } from 'next/headers';
import { getMerchantForUser } from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';
import KycSettingsPage from './page';

describe('KycSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({} as never);
  });

  it('does not render Nigerian KYC forms for India merchants', async () => {
    vi.mocked(getMerchantForUser).mockResolvedValue({
      merchant: { id: 'merchant-1', country: 'IN' },
      staffAccess: { isOwner: true },
    } as never);

    render(await KycSettingsPage());

    expect(screen.getByText(/nigerian kyc not required/i)).toBeInTheDocument();
    expect(screen.queryByTestId('kyc-verification')).not.toBeInTheDocument();
    expect(cookies).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
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
  });
});
