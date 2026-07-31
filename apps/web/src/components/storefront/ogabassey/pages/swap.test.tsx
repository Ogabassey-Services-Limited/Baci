import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchWithCsrf: vi.fn(),
  useMerchantSafe: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: mocks.fetchWithCsrf,
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: mocks.useMerchantSafe,
}));

import { OgabasseyV2Swap } from './swap';

describe('OgabasseyV2Swap', () => {
  beforeEach(() => {
    mocks.fetchWithCsrf.mockReset();
    mocks.useMerchantSafe.mockReturnValue({ merchant: null });
  });

  it('sends the selected device video through the CSRF-aware grading request', async () => {
    mocks.fetchWithCsrf.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          model: 'iPhone 14',
          grade: 'Good',
          observations: [],
          basePrice: 400000,
          estimatedValue: 320000,
          deductionPercent: 20,
          matchedProduct: 'iPhone 14',
        },
      }),
    });

    render(<OgabasseyV2Swap />);

    fireEvent.click(screen.getByRole('button', { name: /start ai trade-in/i }));
    const video = new File(['video'], 'device.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByLabelText(/upload a video/i), {
      target: { files: [video] },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyze device/i }));

    await waitFor(() => {
      expect(mocks.fetchWithCsrf).toHaveBeenCalledWith(
        '/api/ai/grade-device',
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
      );
    });

    const request = mocks.fetchWithCsrf.mock.calls[0]?.[1] as RequestInit;
    expect((request.body as FormData).get('video')).toBe(video);
  });

  it('shows the grading API error and returns to upload when analysis is rejected', async () => {
    mocks.fetchWithCsrf.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'The video is too blurry' }),
    });

    render(<OgabasseyV2Swap />);

    fireEvent.click(screen.getByRole('button', { name: /start ai trade-in/i }));
    const video = new File(['video'], 'device.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByLabelText(/upload a video/i), {
      target: { files: [video] },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyze device/i }));

    expect(
      await screen.findByText('The video is too blurry')
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/upload a video/i)).toBeInTheDocument();
  });
});
