import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  previewProps,
  renderPreview,
  setPuckRenderError,
} from './onboarding-preview/onboarding-preview.test-support';
import { OnboardingPuckPreview } from './onboarding-puck-preview';

describe('OnboardingPuckPreview responsive controls', () => {
  it('opens the expanded preview with a close control', async () => {
    const user = userEvent.setup();
    renderPreview();
    await screen.findByTestId('puck-render');
    await user.click(screen.getByRole('button', { name: /expand/i }));
    expect(
      screen.getByRole('heading', { name: /live store preview/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /close preview/i })
    ).toBeInTheDocument();
  });
  it('closes the expanded preview', async () => {
    const user = userEvent.setup();
    renderPreview();
    await screen.findByTestId('puck-render');
    await user.click(screen.getByRole('button', { name: /expand/i }));
    await user.click(screen.getByRole('button', { name: /close preview/i }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /expand/i })
      ).toBeInTheDocument()
    );
  });
  it('wraps both rendered modes in merchant and cart context', async () => {
    const user = userEvent.setup();
    renderPreview();
    await screen.findByTestId('cart-provider:preview-store');
    expect(screen.getByTestId('merchant-provider')).toHaveAttribute(
      'data-merchant-id',
      'preview-merchant-id'
    );
    await user.click(screen.getByRole('button', { name: /expand/i }));
    const dialog = await screen.findByRole('dialog', {
      name: /live store preview/i,
    });
    expect(
      within(dialog).getByTestId('cart-provider:preview-store')
    ).toBeInTheDocument();
    expect(within(dialog).getByTestId('merchant-provider')).toHaveAttribute(
      'data-merchant-id',
      'preview-merchant-id'
    );
  });
  it('shows the preview fallback for a cart context error', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    setPuckRenderError('useCart must be used within a CartProvider');
    renderPreview();
    expect(
      await screen.findByText(/preview temporarily unavailable/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('puck-render')).not.toBeInTheDocument();
    errorSpy.mockRestore();
  });
  it('resets the error boundary after preview inputs change', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const data = {
      content: [
        {
          type: 'Header',
          props: { id: 'external-header', storeName: 'External Store' },
        },
      ],
      root: { props: { title: 'External' } },
      zones: {},
    };
    setPuckRenderError('useCart must be used within a CartProvider');
    const { rerender } = renderPreview({ businessName: 'Broken Store', data });
    expect(
      await screen.findByText(/preview temporarily unavailable/i)
    ).toBeInTheDocument();
    setPuckRenderError(null);
    rerender(
      <OnboardingPuckPreview
        {...previewProps}
        businessName="Recovered Store"
        data={data}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId('puck-render')).toBeInTheDocument()
    );
    expect(
      screen.queryByText(/preview temporarily unavailable/i)
    ).not.toBeInTheDocument();
    errorSpy.mockRestore();
  });
});
