import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  previewProps,
  renderPreview,
} from './onboarding-preview/onboarding-preview.test-support';
import { OnboardingPuckPreview } from './onboarding-puck-preview';

describe('OnboardingPuckPreview content', () => {
  it('renders fallback message when brand colors are missing', () => {
    renderPreview({ brandColors: undefined });
    expect(
      screen.getByText(/your store preview will appear here/i)
    ).toBeInTheDocument();
  });
  it('renders fallback message when puck data is not loaded', () => {
    renderPreview({ logoDataUri: undefined });
    expect(
      screen.getByText(/your store preview will appear here/i)
    ).toBeInTheDocument();
  });
  it('renders preview with generated content and scoped theme values', async () => {
    const { container } = renderPreview();
    await waitFor(() =>
      expect(screen.getByTestId('puck-render')).toBeInTheDocument()
    );
    expect(screen.getAllByTestId('merchant-provider').length).toBeGreaterThan(
      0
    );
    expect(container.querySelector('[style]')).toBeInTheDocument();
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
  it('calls onEdit with the displayed page', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderPreview({ onEdit });
    await screen.findByTestId('puck-render');
    await user.click(screen.getByRole('button', { name: /edit template/i }));
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.any(Array),
        root: expect.any(Object),
      })
    );
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
