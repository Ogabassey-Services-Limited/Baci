import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialMediaCard } from './social-media-card';

// social_media is an IDENTITY field: it must persist via the dedicated
// /api/merchant/settings PATCH route (updateSocial), NOT the generic hook.
const mockUpdateSocial = vi.fn();
vi.mock('@/hooks/merchant/update-social', () => ({
  updateSocial: (data: Record<string, string>) => mockUpdateSocial(data),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

describe('SocialMediaCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('persists via the dedicated updateSocial path on blur', async () => {
    // Arrange
    vi.useFakeTimers();
    mockUpdateSocial.mockResolvedValueOnce({
      merchant: { id: 'm1', social_media: { twitter: '@oga' } },
    });
    const onChange = vi.fn();
    render(
      <SocialMediaCard
        initialSocialMedia={{ twitter: '' }}
        onSocialMediaChange={onChange}
      />
    );

    const twitterInput = screen.getByLabelText(/twitter/i);

    // Act — type a handle and blur to trigger the debounced autosave.
    fireEvent.change(twitterInput, { target: { value: '@oga' } });
    fireEvent.blur(twitterInput);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // Assert
    expect(mockUpdateSocial).toHaveBeenCalledTimes(1);
    expect(mockUpdateSocial).toHaveBeenCalledWith(
      expect.objectContaining({ twitter: '@oga' })
    );
  });

  it('shows a destructive toast when the dedicated save fails', async () => {
    // Arrange
    vi.useFakeTimers();
    mockUpdateSocial.mockRejectedValueOnce(new Error('boom'));
    render(
      <SocialMediaCard
        initialSocialMedia={{ instagram: '' }}
        onSocialMediaChange={vi.fn()}
      />
    );
    const instagramInput = screen.getByLabelText(/instagram/i);

    // Act
    fireEvent.change(instagramInput, { target: { value: '@oga' } });
    fireEvent.blur(instagramInput);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // Assert
    vi.useRealTimers();
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });
  });
});
