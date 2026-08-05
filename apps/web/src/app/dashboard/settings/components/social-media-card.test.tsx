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
  updateSocial: (...args: unknown[]) => mockUpdateSocial(...args),
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
        merchantId="11111111-1111-4111-8111-111111111111"
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
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({ twitter: '@oga' })
    );
  });

  it('refreshes the merchant mutation baseline after an autosave succeeds', async () => {
    vi.useFakeTimers();
    mockUpdateSocial.mockResolvedValueOnce(undefined);
    const onMerchantMutationSaved = vi.fn().mockResolvedValue(undefined);
    render(
      <SocialMediaCard
        initialSocialMedia={{ twitter: '' }}
        merchantId="merchant-1"
        onMerchantMutationSaved={onMerchantMutationSaved}
        onSocialMediaChange={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/twitter/i), {
      target: { value: '@updated' },
    });
    fireEvent.blur(screen.getByLabelText(/twitter/i));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(onMerchantMutationSaved).toHaveBeenCalledWith('merchant-1');
  });

  it('shows a destructive toast when the dedicated save fails', async () => {
    // Arrange
    vi.useFakeTimers();
    mockUpdateSocial.mockRejectedValueOnce(new Error('boom'));
    render(
      <SocialMediaCard
        initialSocialMedia={{ instagram: '' }}
        merchantId="11111111-1111-4111-8111-111111111111"
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

  it('re-seeds local handles when the selected merchant changes', () => {
    const rendered = render(
      <SocialMediaCard
        initialSocialMedia={{ twitter: '@first-store' }}
        merchantId="merchant-1"
        onSocialMediaChange={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText(/twitter/i), {
      target: { value: '@first-store-draft' },
    });

    rendered.rerender(
      <SocialMediaCard
        initialSocialMedia={{ twitter: '@second-store' }}
        merchantId="merchant-2"
        onSocialMediaChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/twitter/i)).toHaveValue('@second-store');
  });

  it('does not save a first merchant draft after the selected merchant changes', async () => {
    vi.useFakeTimers();
    const rendered = render(
      <SocialMediaCard
        initialSocialMedia={{ twitter: '@first-store' }}
        merchantId="merchant-1"
        onSocialMediaChange={vi.fn()}
      />
    );
    const twitterInput = screen.getByLabelText(/twitter/i);
    fireEvent.change(twitterInput, { target: { value: '@first-store-draft' } });
    fireEvent.blur(twitterInput);

    rendered.rerender(
      <SocialMediaCard
        initialSocialMedia={{ twitter: '@second-store' }}
        merchantId="merchant-2"
        onSocialMediaChange={vi.fn()}
      />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mockUpdateSocial).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not reload or update status when a first merchant save resolves after a switch', async () => {
    vi.useFakeTimers();
    let resolveSave: (() => void) | undefined;
    mockUpdateSocial.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      })
    );
    const rendered = render(
      <SocialMediaCard
        initialSocialMedia={{ twitter: '@first-store' }}
        merchantId="merchant-1"
        onSocialMediaChange={vi.fn()}
      />
    );
    const twitterInput = screen.getByLabelText(/twitter/i);
    fireEvent.change(twitterInput, { target: { value: '@first-store-draft' } });
    fireEvent.blur(twitterInput);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    rendered.rerender(
      <SocialMediaCard
        initialSocialMedia={{ twitter: '@second-store' }}
        merchantId="merchant-2"
        onSocialMediaChange={vi.fn()}
      />
    );
    await act(async () => {
      resolveSave?.();
    });

    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('does not show an old merchant save error after a switch', async () => {
    vi.useFakeTimers();
    let rejectSave: ((error: Error) => void) | undefined;
    mockUpdateSocial.mockReturnValueOnce(
      new Promise<void>((_resolve, reject) => {
        rejectSave = reject;
      })
    );
    const rendered = render(
      <SocialMediaCard
        initialSocialMedia={{ twitter: '@first-store' }}
        merchantId="merchant-1"
        onSocialMediaChange={vi.fn()}
      />
    );
    const twitterInput = screen.getByLabelText(/twitter/i);
    fireEvent.change(twitterInput, { target: { value: '@first-store-draft' } });
    fireEvent.blur(twitterInput);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    rendered.rerender(
      <SocialMediaCard
        initialSocialMedia={{ twitter: '@second-store' }}
        merchantId="merchant-2"
        onSocialMediaChange={vi.fn()}
      />
    );
    await act(async () => {
      rejectSave?.(new Error('first-store failure'));
    });

    expect(mockToast).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
