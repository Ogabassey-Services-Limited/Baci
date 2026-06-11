import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorefrontForm } from './storefront-form';

describe('StorefrontForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps a live region mounted and marks the action busy while submitting', async () => {
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

    const submitButton = screen.getByRole('button', { name: 'Submit' });
    expect(submitButton).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('');

    fireEvent.change(screen.getByLabelText('Name*'), {
      target: { value: 'Ada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(submitButton).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('status')).toHaveTextContent('Submitting form.');
    });
  });
});
