import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleMerchantCustomerReviewsCard } from './google-merchant-customer-reviews-card';

const mockApiPatch = vi.fn();
const mockToast = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('GoogleMerchantCustomerReviewsCard', () => {
  const submitSettingsForm = () => {
    fireEvent.submit(
      screen.getByRole('form', {
        name: /google customer reviews settings/i,
      })
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiPatch.mockResolvedValue({
      custom_settings: {
        google_merchant_id: '112524323',
        agentic_agent_allowlist: ['chatgpt'],
      },
    });
  });

  it('loads the current Merchant Center ID from custom settings', () => {
    render(
      <GoogleMerchantCustomerReviewsCard
        initialCustomSettings={{ google_merchant_id: '112524323' }}
      />
    );

    expect(screen.getByLabelText(/merchant center id/i)).toHaveValue(
      '112524323'
    );
  });

  it('saves the numeric Merchant Center ID while preserving custom settings', async () => {
    render(
      <GoogleMerchantCustomerReviewsCard
        initialCustomSettings={{ agentic_agent_allowlist: ['chatgpt'] }}
      />
    );

    fireEvent.change(screen.getByLabelText(/merchant center id/i), {
      target: { value: ' 112524323 ' },
    });
    submitSettingsForm();

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/api/merchant/features', {
        custom_settings: {
          agentic_agent_allowlist: ['chatgpt'],
          google_merchant_id: '112524323',
        },
      });
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Merchant Center ID saved' })
    );
  });

  it('blocks nonnumeric Merchant Center IDs before saving', async () => {
    render(<GoogleMerchantCustomerReviewsCard />);

    fireEvent.change(screen.getByLabelText(/merchant center id/i), {
      target: { value: 'GMC-112524323' },
    });
    submitSettingsForm();

    await waitFor(() => {
      expect(mockApiPatch).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(
        /enter the numeric merchant center id/i
      );
    });
  });

  it('removes the Merchant Center ID when the field is cleared', async () => {
    mockApiPatch.mockResolvedValueOnce({
      custom_settings: {
        agentic_agent_allowlist: ['chatgpt'],
      },
    });

    render(
      <GoogleMerchantCustomerReviewsCard
        initialCustomSettings={{
          agentic_agent_allowlist: ['chatgpt'],
          google_merchant_id: '112524323',
        }}
      />
    );

    fireEvent.change(screen.getByLabelText(/merchant center id/i), {
      target: { value: '' },
    });
    submitSettingsForm();

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/api/merchant/features', {
        custom_settings: {
          agentic_agent_allowlist: ['chatgpt'],
        },
      });
    });
  });
});
