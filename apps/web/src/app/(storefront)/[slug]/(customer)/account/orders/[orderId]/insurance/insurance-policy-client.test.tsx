import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InsurancePolicyClient } from './insurance-policy-client';
import type { Policy } from './insurance-policy-types';

const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack }),
}));

vi.mock('@mycoverai/mca-javascript-sdk', () => ({
  default: vi.fn(),
}));

const basePolicy: Policy = {
  certificateUrl: 'https://cdn.example.test/policy.pdf',
  claimComment: null,
  claimLink: 'https://mycover.ai/purchase?q=claim',
  claimProgress: null,
  claimStage: null,
  claimStatus: 'None',
  coverage: 250000,
  customer_email: 'customer@example.test',
  expiryDate: '2027-06-25T00:00:00.000Z',
  id: 'policy-1',
  inspectionLink: null,
  inspectionStatus: 'completed',
  itemsInsured: {
    imei: '123456789012345',
    product_id: 'product-1',
    product_name: 'iPhone 15',
  },
  orderDelivered: true,
  policyNumber: 'MC-2048',
  premium: 2500,
  provider: 'Sovereign Trust',
  startDate: '2026-06-25T00:00:00.000Z',
  status: 'active',
};

describe('InsurancePolicyClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders server-fetched policy data and opens the hosted claim flow', () => {
    render(
      <InsurancePolicyClient
        initialResult={{ policy: basePolicy, error: '' }}
      />
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Standard Insurance Policy'
    );
    expect(screen.getByText('MC-2048')).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /file a claim/i }));

    expect(window.open).toHaveBeenCalledWith(
      'https://mycover.ai/purchase?q=claim',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('requires HTTPS certificate links and surfaces claim progress', () => {
    render(
      <InsurancePolicyClient
        initialResult={{
          error: '',
          policy: {
            ...basePolicy,
            certificateUrl: 'http://cdn.example.test/policy.pdf',
            claimProgress: 'Awaiting repair quote',
            claimStatus: 'offer_sent',
          },
        }}
      />
    );

    expect(
      screen.queryByRole('link', { name: /download certificate/i })
    ).toBeNull();
    expect(
      screen.getByText('Progress: Awaiting repair quote')
    ).toBeInTheDocument();
  });

  it('renders the server-fetched error state without a client fetch', () => {
    render(
      <InsurancePolicyClient
        initialResult={{ policy: null, error: 'No active policy.' }}
      />
    );

    expect(screen.getByText('Policy Not Found')).toBeInTheDocument();
    expect(screen.getByText('No active policy.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /go back/i }));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
