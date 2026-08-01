import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { GoogleReviewAuthoritySettingsCard } from '@/app/dashboard/settings/trust/google-review-authority-settings-card';

const mockApiPatch = vi.fn();
const mockToast = vi.fn();
const originalResizeObserver = globalThis.ResizeObserver;

class MockResizeObserver {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

vi.mock('@/lib/api-client', () => ({
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('GoogleReviewAuthoritySettingsCard', () => {
  beforeAll(() => {
    globalThis.ResizeObserver =
      MockResizeObserver as unknown as typeof ResizeObserver;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiPatch.mockResolvedValue({
      google_place_id: 'ChIJ1234',
      google_reviews_enabled: true,
    });
  });

  afterAll(() => {
    globalThis.ResizeObserver = originalResizeObserver;
  });

  it('loads the current Google review authority settings', () => {
    render(
      <GoogleReviewAuthoritySettingsCard
        merchantId="22222222-2222-4222-8222-222222222222"
        initialGooglePlaceId="places/ChIJ1234"
        initialGoogleReviewsEnabled={true}
      />
    );

    expect(
      screen.getByRole('switch', {
        name: /use google reviews for merchant trust/i,
      })
    ).toBeChecked();
    expect(screen.getByLabelText(/google place id/i)).toHaveValue(
      'places/ChIJ1234'
    );
  });

  it('saves a normalized Google Place ID through merchant feature settings', async () => {
    render(
      <GoogleReviewAuthoritySettingsCard
        merchantId="22222222-2222-4222-8222-222222222222"
        initialGooglePlaceId={null}
        initialGoogleReviewsEnabled={false}
      />
    );

    fireEvent.click(
      screen.getByRole('switch', {
        name: /use google reviews for merchant trust/i,
      })
    );
    fireEvent.change(screen.getByLabelText(/google place id/i), {
      target: { value: ' places/ChIJ1234 ' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /save google reviews/i })
    );

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/api/merchant/features', {
        google_place_id: 'ChIJ1234',
        google_reviews_enabled: true,
        merchantId: '22222222-2222-4222-8222-222222222222',
      });
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Google review authority saved',
      })
    );
  });

  it('blocks malformed place IDs before saving', async () => {
    render(
      <GoogleReviewAuthoritySettingsCard
        merchantId="22222222-2222-4222-8222-222222222222"
        initialGooglePlaceId={null}
        initialGoogleReviewsEnabled={true}
      />
    );

    fireEvent.change(screen.getByLabelText(/google place id/i), {
      target: { value: '../../etc/passwd' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /save google reviews/i })
    );

    await waitFor(() => {
      expect(mockApiPatch).not.toHaveBeenCalled();
      expect(
        screen.getByText(/enter a valid google place id/i)
      ).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/google place id/i)).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });

  it('preserves the place ID when Google review authority is disabled', async () => {
    render(
      <GoogleReviewAuthoritySettingsCard
        merchantId="22222222-2222-4222-8222-222222222222"
        initialGooglePlaceId="ChIJ1234"
        initialGoogleReviewsEnabled={true}
      />
    );

    fireEvent.click(
      screen.getByRole('switch', {
        name: /use google reviews for merchant trust/i,
      })
    );
    fireEvent.click(
      screen.getByRole('button', { name: /save google reviews/i })
    );

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/api/merchant/features', {
        google_place_id: 'ChIJ1234',
        google_reviews_enabled: false,
        merchantId: '22222222-2222-4222-8222-222222222222',
      });
    });
  });

  it('shows an error toast when saving fails', async () => {
    mockApiPatch.mockRejectedValueOnce(new Error('network'));
    render(
      <GoogleReviewAuthoritySettingsCard
        merchantId="22222222-2222-4222-8222-222222222222"
        initialGooglePlaceId="ChIJ1234"
        initialGoogleReviewsEnabled={true}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /save google reviews/i })
    );

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/api/merchant/features', {
        google_place_id: 'ChIJ1234',
        google_reviews_enabled: true,
        merchantId: '22222222-2222-4222-8222-222222222222',
      });
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        variant: 'destructive',
      })
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      /failed to save google review settings/i
    );
  });

  it('resets for merchant B and ignores merchant A save completion after a switch', async () => {
    let resolveMerchantASave: (value: MerchantGoogleReviewResponse) => void =
      () => undefined;
    mockApiPatch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMerchantASave = resolve;
        })
    );

    const { rerender } = render(
      <GoogleReviewAuthoritySettingsCard
        merchantId="11111111-1111-4111-8111-111111111111"
        initialGooglePlaceId="ChIJA"
        initialGoogleReviewsEnabled={true}
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: /save google reviews/i })
    );

    rerender(
      <GoogleReviewAuthoritySettingsCard
        merchantId="22222222-2222-4222-8222-222222222222"
        initialGooglePlaceId="ChIJB"
        initialGoogleReviewsEnabled={false}
      />
    );

    expect(
      screen.getByRole('switch', {
        name: /use google reviews for merchant trust/i,
      })
    ).not.toBeChecked();
    expect(screen.getByLabelText(/google place id/i)).toHaveValue('ChIJB');

    resolveMerchantASave({
      google_place_id: 'ChIJA',
      google_reviews_enabled: true,
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/google place id/i)).toHaveValue('ChIJB');
    });
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('accepts saves after the StrictMode lifecycle replay', async () => {
    render(
      <StrictMode>
        <GoogleReviewAuthoritySettingsCard
          merchantId="22222222-2222-4222-8222-222222222222"
          initialGooglePlaceId="ChIJ1234"
          initialGoogleReviewsEnabled={true}
        />
      </StrictMode>
    );

    fireEvent.click(
      screen.getByRole('button', { name: /save google reviews/i })
    );

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Google review authority saved' })
      );
    });
  });
});

interface MerchantGoogleReviewResponse {
  google_place_id: string;
  google_reviews_enabled: boolean;
}
