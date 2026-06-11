import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorefrontForm } from './storefront-form';

describe('StorefrontForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps a live region mounted and marks the form busy while submitting', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise(() => undefined))
    );

    render(
      <StorefrontForm
        formName="Contact"
        merchantId="merchant-1"
        fields={[{ id: 'name', label: 'Name', type: 'text', required: true }]}
      />
    );

    const form = screen.getByRole('button', { name: 'Submit' }).closest('form');
    expect(form).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('');

    fireEvent.change(screen.getByLabelText('Name*'), {
      target: { value: 'Ada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(form).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('status')).toHaveTextContent('Submitting form.');
    });
  });
});
