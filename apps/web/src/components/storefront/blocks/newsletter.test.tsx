import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Newsletter } from './newsletter';

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => ({
    merchant: { id: '4db63f48-3577-4ef3-9e09-e3ec6af7a5a2' },
  }),
}));

describe('Newsletter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits the subscriber email to the newsletter API', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

    render(<Newsletter />);

    fireEvent.change(screen.getByPlaceholderText('Enter your email address'), {
      target: { value: 'Customer@Example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/newsletter/subscribe', {
        body: JSON.stringify({
          email: 'Customer@Example.com',
          merchantId: '4db63f48-3577-4ef3-9e09-e3ec6af7a5a2',
          source: 'footer',
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
    });
    expect(
      screen.getByText('You are subscribed. Check your email for updates.')
    ).toBeInTheDocument();
  });

  it('shows an error when the newsletter API rejects the subscription', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Failed' }), { status: 500 })
    );

    render(<Newsletter />);

    fireEvent.change(screen.getByPlaceholderText('Enter your email address'), {
      target: { value: 'customer@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));

    expect(
      await screen.findByRole('alert', {
        name: 'Newsletter subscription failed',
      })
    ).toHaveTextContent('Could not subscribe right now. Please try again.');
  });
});
