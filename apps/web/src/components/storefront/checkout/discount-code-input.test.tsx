import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/csrf', () => ({
  buildCsrfHeaders: () => ({ 'x-csrf-token': 'test-csrf-token' }),
}));

import { DiscountCodeInput } from './discount-code-input';

describe('DiscountCodeInput', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the already parsed 403 payload without reading response body twice', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ valid: false, error: 'Code expired' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(
      <DiscountCodeInput
        merchantId="merchant-1"
        cartTotal={5000}
        onApply={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText('Enter discount code'),
      'save10'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(screen.getByText('Code expired')).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('sends product_ids for targeted UX preflight and forwards the server discount_amount to onApply', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          valid: true,
          discount_code_id: '33333333-3333-4333-8333-333333333333',
          code: 'SAVE10',
          discount_type: 'percentage',
          discount_value: 10,
          discount_amount: 500,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const onApply = vi.fn();

    render(
      <DiscountCodeInput
        merchantId="merchant-1"
        cartTotal={5000}
        productIds={['p-1', 'p-2']}
        onApply={onApply}
        onRemove={vi.fn()}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText('Enter discount code'),
      'save10'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({ discount_amount: 500, code: 'SAVE10' })
      );
    });

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(body.product_ids).toEqual(['p-1', 'p-2']);
  });

  it('fails fast when csrf refresh endpoint returns non-ok during retry', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ valid: false, error: 'Invalid CSRF token' }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'csrf unavailable' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    render(
      <DiscountCodeInput
        merchantId="merchant-1"
        cartTotal={5000}
        onApply={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    await userEvent.type(
      screen.getByPlaceholderText('Enter discount code'),
      'save10'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(
        screen.getByText('Failed to validate code. Please try again.')
      ).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1]?.[0]).toBe('/api/csrf');
  });
});
