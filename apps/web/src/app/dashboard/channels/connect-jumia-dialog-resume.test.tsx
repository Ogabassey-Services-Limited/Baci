import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const mockDiscoverJumiaShops = vi.fn().mockResolvedValue({
  ok: true,
  discoveryId: '00000000-0000-4000-8000-000000000099',
  shops: [
    {
      id: 'shop-1',
      name: 'Resumable Shop',
      countryCode: 'NG',
      marketplace: 'Jumia Nigeria',
      alreadyConnected: false,
    },
  ],
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('./use-jumia-integrations', () => ({
  discoverJumiaShops: (...args: unknown[]) => mockDiscoverJumiaShops(...args),
  connectJumiaShops: vi.fn(),
}));

import { ConnectJumiaDialog } from './connect-jumia-dialog';

describe('ConnectJumiaDialog resumable discovery', () => {
  it('preserves the opaque discovery while clearing the refresh credential', async () => {
    const user = userEvent.setup();
    const props = {
      onOpenChange: vi.fn(),
      onConnected: vi.fn(),
    };
    const { rerender } = render(<ConnectJumiaDialog open {...props} />);

    await user.click(
      screen.getByRole('button', { name: /enter refresh token/i })
    );
    await user.type(screen.getByLabelText(/client id/i), 'client-id');
    await user.type(screen.getByLabelText(/refresh token/i), 'rotating-token');
    await user.click(screen.getByRole('button', { name: /discover shops/i }));
    await waitFor(() => {
      expect(screen.getByText('Resumable Shop')).toBeInTheDocument();
    });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    rerender(<ConnectJumiaDialog open={false} {...props} />);
    rerender(<ConnectJumiaDialog open {...props} />);
    await user.click(
      screen.getByRole('button', { name: /enter refresh token/i })
    );

    expect(screen.getByText('Resumable Shop')).toBeInTheDocument();
    expect(screen.getByLabelText(/refresh token/i)).toHaveValue('');
  });
});
