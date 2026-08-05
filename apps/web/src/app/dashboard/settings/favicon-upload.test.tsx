import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FaviconUpload } from './favicon-upload';

const uploadFavicon = vi.hoisted(() => vi.fn());

vi.mock('@/app/dashboard/settings/actions', () => ({ uploadFavicon }));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({ merchant: null }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('next/image', () => ({ default: () => null }));

describe('FaviconUpload', () => {
  it('refreshes the settings profile baseline after the favicon row update succeeds', async () => {
    const onMerchantMutationSaved = vi.fn().mockResolvedValue(undefined);
    uploadFavicon.mockResolvedValue({
      success: true,
      result: { png_32_url: 'https://cdn.example/favicon.png' },
    });
    render(
      <FaviconUpload
        merchantId="merchant-a"
        onMerchantMutationSaved={onMerchantMutationSaved}
      />
    );

    fireEvent.change(screen.getByLabelText('Upload favicon file'), {
      target: {
        files: [new File(['icon'], 'favicon.png', { type: 'image/png' })],
      },
    });

    await waitFor(() => {
      expect(onMerchantMutationSaved).toHaveBeenCalledWith('merchant-a');
    });
  });
});
