import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { deriveCuratedTheme } from '@/lib/storefront-defaults/derive-curated-theme';
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
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
  it('moves focus into the modal dialog and keeps Tab navigation there', async () => {
    const user = userEvent.setup();
    renderPreview();
    await screen.findByTestId('puck-render');
    await user.click(screen.getByRole('button', { name: /expand/i }));
    const dialog = await screen.findByRole('dialog', {
      name: /live store preview/i,
    });

    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true)
    );
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
  it('closes the expanded dialog with Escape and restores trigger focus', async () => {
    const user = userEvent.setup();
    renderPreview();
    const trigger = await screen.findByRole('button', { name: /expand/i });
    await user.click(trigger);
    await screen.findByRole('dialog', { name: /live store preview/i });

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /live store preview/i })
      ).not.toBeInTheDocument()
    );
    expect(trigger).toHaveFocus();
  });
  it('closes the expanded preview', async () => {
    const user = userEvent.setup();
    renderPreview();
    await screen.findByTestId('puck-render');
    await user.click(screen.getByRole('button', { name: /expand/i }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
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
    expect(screen.getAllByTestId('puck-render')).toHaveLength(1);
  });
  it.each([
    {
      label: 'dark',
      brandColors: {
        primary: '#ffffff',
        background: '#000000',
        accent: '#ff0000',
      },
    },
    {
      label: 'light',
      brandColors: {
        primary: '#000000',
        background: '#FFFFFF',
        accent: '#00ff00',
      },
    },
  ])('keeps $label theme tokens scoped after opening the portaled preview', async ({
    brandColors,
  }) => {
    const user = userEvent.setup();
    const theme = deriveCuratedTheme(brandColors, 'fashion');
    renderPreview({ brandColors });
    await screen.findByTestId('puck-render');
    expect(screen.getByTestId('preview-inline-surface')).toHaveStyle({
      '--store-background': theme.colors.background,
      '--store-background-text': theme.colors.foreground,
      color: 'var(--theme-foreground)',
    });

    await user.click(screen.getByRole('button', { name: /expand/i }));
    const dialog = await screen.findByRole('dialog', {
      name: /live store preview/i,
    });
    expect(within(dialog).getByTestId('preview-expanded-surface')).toHaveStyle({
      '--store-background': theme.colors.background,
      '--store-background-text': theme.colors.foreground,
      color: 'var(--theme-foreground)',
    });
    expect(
      screen.queryByTestId('preview-inline-surface')
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId('puck-render')).toHaveLength(1);
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
