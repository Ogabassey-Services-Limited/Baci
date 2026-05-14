import { render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/merchant-server', () => ({
  getMerchantForUser: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('./trust-settings-client', () => ({
  TrustSettingsClient: ({
    initialTrustProfile,
  }: {
    initialTrustProfile?: { founded_year?: number | null } | null;
  }) => <div>trust:{initialTrustProfile?.founded_year ?? 'none'}</div>,
}));

vi.mock(
  '@/components/dashboard/integrations/agent-commerce-trust-readiness-card',
  () => ({
    AgentCommerceTrustReadinessCard: () => <div>agent-trust-health</div>,
  })
);

vi.mock(
  '@/components/dashboard/integrations/agent-commerce-controls-card',
  () => ({
    AgentCommerceControlsCard: ({
      initialEnabled,
    }: {
      initialEnabled: boolean;
    }) => <div>agent-commerce-controls:{String(initialEnabled)}</div>,
  })
);

import { getMerchantForUser } from '@/lib/merchant-server';
import TrustSettingsPage from './page';

describe('dashboard trust settings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the current merchant trust profile into the client surface', async () => {
    vi.mocked(getMerchantForUser).mockResolvedValue({
      merchant: {
        id: 'merchant-1',
        trust_profile: {
          founded_year: 2018,
        },
        feature_settings: {
          agentic_checkout_enabled: true,
        },
      },
    } as never);

    render(await TrustSettingsPage());

    expect(screen.getByText('trust:2018')).toBeInTheDocument();
    expect(
      screen.getByText('agent-commerce-controls:true')
    ).toBeInTheDocument();
    expect(screen.getByText('agent-trust-health')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /back to settings/i })
    ).toHaveAttribute('href', '/dashboard/settings');
  });

  it('passes disabled agent checkout state into the controls card', async () => {
    vi.mocked(getMerchantForUser).mockResolvedValue({
      merchant: {
        id: 'merchant-1',
        trust_profile: null,
        feature_settings: {
          agentic_checkout_enabled: false,
        },
      },
    } as never);

    render(await TrustSettingsPage());

    expect(
      screen.getByText('agent-commerce-controls:false')
    ).toBeInTheDocument();
  });
});
