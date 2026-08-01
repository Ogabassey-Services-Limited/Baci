import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiPost = vi.fn();
const mockToast = vi.fn();

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({
    merchant: { id: 'merchant-1', slug: 'oldstore' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/api-client', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

const { ChangeStoreUrl } = await import('./change-store-url');

function typeNewSlug(value: string) {
  fireEvent.change(screen.getByLabelText('New URL'), {
    target: { value },
  });
}

describe('ChangeStoreUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the current store URL', () => {
    render(<ChangeStoreUrl />);
    expect(
      screen.getByText((_, el) => el?.textContent === 'oldstore.usebaci.com')
    ).toBeInTheDocument();
  });

  it('disables the change button for an empty or unchanged slug', () => {
    render(<ChangeStoreUrl />);
    const button = screen.getByRole('button', { name: 'Change URL' });
    expect(button).toBeDisabled();

    typeNewSlug('oldstore'); // same as current
    expect(button).toBeDisabled();

    typeNewSlug('ab'); // too short
    expect(button).toBeDisabled();

    typeNewSlug('newstore'); // valid + changed
    expect(button).toBeEnabled();
  });

  it('renames through the API and confirms success', async () => {
    mockApiPost.mockResolvedValue({
      slug: 'newstore',
      url: 'https://newstore.usebaci.com',
    });
    render(<ChangeStoreUrl />);

    typeNewSlug('newstore');
    fireEvent.click(screen.getByRole('button', { name: 'Change URL' }));

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change URL' }));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/api/merchant/rename-slug', {
        merchantId: 'merchant-1',
        new_slug: 'newstore',
      })
    );
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Store URL changed' })
      )
    );
  });

  it('surfaces the server error message when the rename fails', async () => {
    mockApiPost.mockRejectedValue(
      new Error('That store URL is already taken.')
    );
    render(<ChangeStoreUrl />);

    typeNewSlug('takenstore');
    fireEvent.click(screen.getByRole('button', { name: 'Change URL' }));

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change URL' }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Could not change URL',
          description: 'That store URL is already taken.',
          variant: 'destructive',
        })
      )
    );
  });

  it('shows a disabled loading state while the rename is in flight', async () => {
    let resolveRename!: (value: { slug: string; url: string }) => void;
    mockApiPost.mockReturnValue(
      new Promise<{ slug: string; url: string }>((resolve) => {
        resolveRename = resolve;
      })
    );
    render(<ChangeStoreUrl />);

    typeNewSlug('newstore');
    fireEvent.click(screen.getByRole('button', { name: 'Change URL' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change URL' }));

    // While the request is pending, the trigger shows the loading label and is
    // disabled so the merchant can't double-submit.
    const loadingButton = await screen.findByRole('button', {
      name: /changing/i,
    });
    expect(loadingButton).toBeDisabled();

    // Let it settle so the test doesn't leak a pending promise / act() warning.
    resolveRename({ slug: 'newstore', url: 'https://newstore.usebaci.com' });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Store URL changed' })
      )
    );
  });
});
