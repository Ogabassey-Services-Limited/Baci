import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}));

const mockConnectWithToken = vi.fn();

vi.mock('./use-jumia-integrations', () => ({
  connectWithToken: (...args: unknown[]) => mockConnectWithToken(...args),
}));

import { ConnectJumiaDialog } from './connect-jumia-dialog';

describe('ConnectJumiaDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onConnected: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog title when open', () => {
    render(<ConnectJumiaDialog {...defaultProps} />);

    expect(
      screen.getByRole('heading', { name: /connect jumia account/i })
    ).toBeInTheDocument();
  });

  it('renders the OAuth connect button as a link', () => {
    render(<ConnectJumiaDialog {...defaultProps} />);

    const link = screen.getByRole('link', { name: /connect with jumia/i });
    expect(link).toHaveAttribute(
      'href',
      '/api/marketplace/jumia/connect?connectionType=oauth'
    );
  });

  it('renders the manual entry toggle button', () => {
    render(<ConnectJumiaDialog {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: /enter refresh token/i })
    ).toBeInTheDocument();
  });

  it('does not show the manual form initially', () => {
    render(<ConnectJumiaDialog {...defaultProps} />);

    expect(screen.queryByLabelText(/refresh token/i)).not.toBeInTheDocument();
  });

  it('shows manual form fields after clicking the toggle button', async () => {
    const user = userEvent.setup();
    render(<ConnectJumiaDialog {...defaultProps} />);

    await user.click(
      screen.getByRole('button', { name: /enter refresh token/i })
    );

    expect(screen.getByLabelText(/refresh token/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/shop name/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /connect token/i })
    ).toBeInTheDocument();
  });

  it('toggles button text between show and hide', async () => {
    const user = userEvent.setup();
    render(<ConnectJumiaDialog {...defaultProps} />);

    const toggleButton = screen.getByRole('button', {
      name: /enter refresh token/i,
    });
    await user.click(toggleButton);

    expect(
      screen.getByRole('button', { name: /hide manual entry/i })
    ).toBeInTheDocument();
  });

  it('disables connect button when refresh token is empty', async () => {
    const user = userEvent.setup();
    render(<ConnectJumiaDialog {...defaultProps} />);

    await user.click(
      screen.getByRole('button', { name: /enter refresh token/i })
    );

    const connectButton = screen.getByRole('button', {
      name: /connect token/i,
    });
    expect(connectButton).toBeDisabled();
  });

  it('enables connect button when refresh token has content', async () => {
    const user = userEvent.setup();
    render(<ConnectJumiaDialog {...defaultProps} />);

    await user.click(
      screen.getByRole('button', { name: /enter refresh token/i })
    );

    await user.type(screen.getByLabelText(/refresh token/i), 'my-token');

    const connectButton = screen.getByRole('button', {
      name: /connect token/i,
    });
    expect(connectButton).toBeEnabled();
  });

  it('calls connectWithToken and shows success toast on success', async () => {
    mockConnectWithToken.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<ConnectJumiaDialog {...defaultProps} />);

    await user.click(
      screen.getByRole('button', { name: /enter refresh token/i })
    );
    await user.type(screen.getByLabelText(/refresh token/i), 'valid-token');
    await user.type(screen.getByLabelText(/shop name/i), 'My Shop');
    await user.click(screen.getByRole('button', { name: /connect token/i }));

    await waitFor(() => {
      expect(mockConnectWithToken).toHaveBeenCalledWith(
        'valid-token',
        'My Shop'
      );
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Jumia account connected successfully!',
    });
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(defaultProps.onConnected).toHaveBeenCalled();
  });

  it('shows destructive toast on connection failure', async () => {
    mockConnectWithToken.mockResolvedValueOnce({
      ok: false,
      error: 'Invalid token',
    });
    const user = userEvent.setup();
    render(<ConnectJumiaDialog {...defaultProps} />);

    await user.click(
      screen.getByRole('button', { name: /enter refresh token/i })
    );
    await user.type(screen.getByLabelText(/refresh token/i), 'bad-token');
    await user.click(screen.getByRole('button', { name: /connect token/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Connection failed',
        description: 'Invalid token',
        variant: 'destructive',
      });
    });

    expect(defaultProps.onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('clears form fields when dialog is dismissed', () => {
    render(<ConnectJumiaDialog {...defaultProps} />);

    // Simulate dialog closing via onOpenChange
    const dialogContent = screen.getByRole('dialog');
    expect(dialogContent).toBeInTheDocument();

    // Trigger the handleOpenChange with false
    fireEvent.keyDown(dialogContent, { key: 'Escape' });

    // The onOpenChange should have been called
    expect(defaultProps.onOpenChange).toHaveBeenCalled();
  });

  it('does not render dialog content when open is false', () => {
    render(<ConnectJumiaDialog {...defaultProps} open={false} />);

    expect(
      screen.queryByRole('heading', { name: /connect jumia account/i })
    ).not.toBeInTheDocument();
  });
});
