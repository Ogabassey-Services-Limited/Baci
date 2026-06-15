import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Newsletter } from './newsletter';

const { fetchWithCsrfMock } = vi.hoisted(() => ({
  fetchWithCsrfMock: vi.fn(),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => ({
    merchant: { id: '4db63f48-3577-4ef3-9e09-e3ec6af7a5a2' },
  }),
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: fetchWithCsrfMock,
}));

describe('Newsletter', () => {
  beforeEach(() => {
    fetchWithCsrfMock.mockReset();
  });

  it('submits the subscriber email to the newsletter API', async () => {
    fetchWithCsrfMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    render(<Newsletter />);

    fireEvent.change(screen.getByPlaceholderText('Enter your email address'), {
      target: { value: 'Customer@Example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));

    await waitFor(() => {
      expect(fetchWithCsrfMock).toHaveBeenCalledWith(
        '/api/newsletter/subscribe',
        {
          body: JSON.stringify({
            email: 'Customer@Example.com',
            merchantId: '4db63f48-3577-4ef3-9e09-e3ec6af7a5a2',
            source: 'footer',
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        }
      );
    });
    expect(
      screen.getByText('You are subscribed. Check your email for updates.')
    ).toBeInTheDocument();
  });

  it('exposes the email input with an accessible name (WCAG 4.1.2)', () => {
    render(<Newsletter />);

    expect(
      screen.getByRole('textbox', { name: 'Email address' })
    ).toBeInstanceOf(HTMLInputElement);
  });

  it('shows an error when the newsletter API rejects the subscription', async () => {
    fetchWithCsrfMock.mockResolvedValue(
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
