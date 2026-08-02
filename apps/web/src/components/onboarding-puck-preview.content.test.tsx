import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  previewProps,
  renderPreview,
} from './onboarding-preview/onboarding-preview.test-support';
import { OnboardingPuckPreview } from './onboarding-puck-preview';

describe('OnboardingPuckPreview content', () => {
  it('shows loading before the fallback when brand colors are missing', async () => {
    renderPreview({ brandColors: undefined });
    expect(
      screen.getByRole('status', { name: /loading store preview/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/your store preview will appear here/i)
    ).toBeInTheDocument();
  });
  it('shows loading before generating preview data without a logo', async () => {
    renderPreview({ logoDataUri: undefined });
    expect(
      screen.getByRole('status', { name: /loading store preview/i })
    ).toBeInTheDocument();
    expect(await screen.findByTestId('puck-render')).toBeInTheDocument();
  });
  it('renders preview with generated content and scoped theme values', async () => {
    renderPreview({
      brandColors: {
        primary: '#ffffff',
        background: '#000000',
        accent: '#ff0000',
      },
    });
    await waitFor(() =>
      expect(screen.getByTestId('puck-render')).toBeInTheDocument()
    );
    expect(screen.getByTestId('preview-inline-surface')).toHaveStyle({
      '--store-background': '#000000',
      '--store-background-text': '#FFFFFF',
      color: 'var(--theme-foreground)',
    });
  });
  it('uses the derived light foreground for a non-black dark background', async () => {
    renderPreview({
      brandColors: {
        primary: '#ffffff',
        background: '#111111',
        accent: '#ff0000',
      },
    });

    await screen.findByTestId('puck-render');
    expect(screen.getByTestId('preview-inline-surface')).toHaveStyle({
      '--store-background': '#111111',
      '--store-background-text': '#FFFFFF',
    });
  });
  it('renders the deterministic single-H1 hero in preview data', async () => {
    renderPreview();
    await waitFor(() =>
      expect(screen.getByTestId('puck-render').textContent).toContain(
        '"type":"Hero"'
      )
    );
    expect(screen.getByTestId('puck-render').textContent).toContain(
      '"headingLevel":"h1"'
    );
  });
  it('passes the exact logo-patched external page to Edit', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const externalData = {
      content: [
        {
          type: 'Header',
          props: { id: 'external-header', storeName: 'External Store' },
        },
        { type: 'Text', props: { id: 'external-text', title: 'External' } },
      ],
      root: { props: { title: 'External' } },
      zones: {},
    };
    renderPreview({
      data: externalData,
      logoDataUri: 'data:image/png;base64,changed-logo',
      onEdit,
    });
    await screen.findByTestId('puck-render');
    await user.click(screen.getByRole('button', { name: /edit template/i }));
    expect(onEdit).toHaveBeenCalledWith({
      content: [
        {
          type: 'Header',
          props: {
            id: 'external-header',
            storeName: 'External Store',
            logoUrl: 'data:image/png;base64,changed-logo',
          },
        },
        { type: 'Text', props: { id: 'external-text', title: 'External' } },
      ],
      root: { props: { title: 'External' } },
      zones: {},
    });
  });
  it('patches a changed logo URL into puck data', async () => {
    const { rerender } = renderPreview({
      logoDataUri: 'data:image/png;base64,initial',
    });
    await screen.findByTestId('puck-render');
    rerender(
      <OnboardingPuckPreview
        {...previewProps}
        logoDataUri="data:image/png;base64,updated"
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId('puck-render').textContent).toContain(
        'data:image/png;base64,updated'
      )
    );
  });
  it('uses external data immediately', async () => {
    renderPreview({
      data: {
        content: [
          {
            type: 'Header',
            props: { id: 'external-header', storeName: 'External Store' },
          },
        ],
        root: { props: { title: 'External' } },
        zones: {},
      },
    });
    await waitFor(() =>
      expect(screen.getByTestId('puck-render').textContent).toContain(
        'external-header'
      )
    );
  });
  it('regenerates content for changed business inputs', async () => {
    const { rerender } = renderPreview({ businessName: 'Store One' });
    await screen.findByTestId('puck-render');
    rerender(
      <OnboardingPuckPreview
        {...previewProps}
        businessName="Store Two"
        businessType="electronics"
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId('puck-render').textContent).toContain(
        'Store Two'
      )
    );
  });
  it('omits edit controls without an edit callback', async () => {
    renderPreview();
    await screen.findByTestId('puck-render');
    expect(
      screen.queryByRole('button', { name: /edit template/i })
    ).not.toBeInTheDocument();
  });
});
