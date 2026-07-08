import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaypalConnectionForm } from './paypal-connection-form';

const baseProps = {
  mode: 'sandbox' as const,
  modePending: false,
  onModeChange: vi.fn(),
  isConnectedForMode: false,
  last4: null,
  reconnectError: null,
  clientId: '',
  onClientIdChange: vi.fn(),
  secretKey: '',
  onSecretKeyChange: vi.fn(),
  saving: false,
  saveError: null,
  onSave: vi.fn(),
};

describe('PaypalConnectionForm', () => {
  it('shows the connect call-to-action when not yet connected', () => {
    // Arrange / Act
    render(<PaypalConnectionForm {...baseProps} />);

    // Assert
    expect(
      screen.getByRole('button', { name: /connect paypal/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/^connected$/i)).not.toBeInTheDocument();
  });

  it('shows the connected badge and last4 when connected', () => {
    // Arrange / Act
    render(
      <PaypalConnectionForm {...baseProps} isConnectedForMode last4="6789" />
    );

    // Assert
    expect(screen.getByText(/^connected$/i)).toBeInTheDocument();
    expect(screen.getByText(/ending in 6789/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /update credentials/i })
    ).toBeInTheDocument();
  });

  it('surfaces a reconnect banner with the stored validation error', () => {
    // Arrange / Act
    render(
      <PaypalConnectionForm
        {...baseProps}
        reconnectError="PayPal rejected these credentials."
      />
    );

    // Assert
    expect(screen.getByText(/paypal disconnected/i)).toBeInTheDocument();
    expect(
      screen.getByText(/paypal rejected these credentials\..*reconnect below/i)
    ).toBeInTheDocument();
  });

  it('disables save until both client ID and secret are filled', async () => {
    // Arrange
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <PaypalConnectionForm
        {...baseProps}
        clientId="only-client-id"
        onSave={onSave}
      />
    );
    const saveButton = screen.getByRole('button', { name: /connect paypal/i });

    // Act
    expect(saveButton).toBeDisabled();
    await user.click(saveButton);

    // Assert
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onSave when both fields are present', async () => {
    // Arrange
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <PaypalConnectionForm
        {...baseProps}
        clientId="client-123456789"
        secretKey="secret-123456789"
        onSave={onSave}
      />
    );

    // Act
    await user.click(screen.getByRole('button', { name: /connect paypal/i }));

    // Assert
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('shows the inline save error', () => {
    // Arrange / Act
    render(
      <PaypalConnectionForm
        {...baseProps}
        saveError="PayPal rejected these credentials."
      />
    );

    // Assert
    expect(
      screen.getByText(/paypal rejected these credentials\./i)
    ).toBeInTheDocument();
  });
});
