import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentCredentialStatusResponse } from './paypal-provider-status';

const toastMock = vi.hoisted(() => vi.fn());
const loadPaypalCardDataMock = vi.hoisted(() => vi.fn());
const persistPaypalFeatureConfigMock = vi.hoisted(() => vi.fn());
const savePaypalCredentialsMock = vi.hoisted(() => vi.fn());
const deletePaypalCredentialsMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('./paypal-provider-requests', () => ({
  loadPaypalCardData: loadPaypalCardDataMock,
  persistPaypalFeatureConfig: persistPaypalFeatureConfigMock,
  savePaypalCredentials: savePaypalCredentialsMock,
  deletePaypalCredentials: deletePaypalCredentialsMock,
}));

import { PaypalProviderCard } from './paypal-provider-card';

const disconnectedStatus: PaymentCredentialStatusResponse = {
  configured: false,
  roles: [],
};

const connectedStatus: PaymentCredentialStatusResponse = {
  configured: true,
  roles: [
    {
      role: 'client_id',
      environment: 'test',
      last4: '1234',
      isActive: true,
      lastValidatedAt: '2026-07-08T00:00:00.000Z',
      lastValidationError: null,
    },
    {
      role: 'secret_key',
      environment: 'test',
      last4: '6789',
      isActive: true,
      lastValidatedAt: '2026-07-08T00:00:00.000Z',
      lastValidationError: null,
    },
  ],
};

function mockInitialLoad(status: PaymentCredentialStatusResponse) {
  loadPaypalCardDataMock.mockImplementation(
    (options: {
      setStatus: (value: PaymentCredentialStatusResponse | null) => void;
      setEnabled: (value: boolean) => void;
      setMode: (value: 'sandbox' | 'live') => void;
      setCustomSettings: (value: Record<string, unknown>) => void;
      setLoading: (value: boolean) => void;
    }) => {
      options.setStatus(status);
      options.setEnabled(status.configured);
      options.setMode('sandbox');
      options.setCustomSettings({ paypal_enabled: status.configured });
      options.setLoading(false);
      return Promise.resolve();
    }
  );
}

async function fillCredentialForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/client id/i), 'client-id-1234567890');
  await user.type(
    screen.getByLabelText(/secret key/i),
    'secret-key-1234567890'
  );
}

describe('PaypalProviderCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInitialLoad(disconnectedStatus);
  });

  it('renders the disconnected state with a connect call-to-action', async () => {
    // Arrange / Act
    render(<PaypalProviderCard />);

    // Assert
    expect(
      await screen.findByRole('heading', { name: /paypal checkout/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /connect paypal/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/^connected$/i)).not.toBeInTheDocument();
  });

  it('disables the enable toggle while PayPal is not configured', async () => {
    // Arrange / Act
    render(<PaypalProviderCard />);

    // Assert
    const toggle = await screen.findByRole('switch', {
      name: /enable paypal checkout/i,
    });
    expect(toggle).toBeDisabled();
    expect(toggle).not.toBeChecked();
  });

  it('shows the connected badge and last4 after a successful save', async () => {
    // Arrange
    const user = userEvent.setup();
    savePaypalCredentialsMock.mockResolvedValue(connectedStatus);
    render(<PaypalProviderCard />);
    await screen.findByRole('button', { name: /connect paypal/i });

    // Act
    await fillCredentialForm(user);
    await user.click(screen.getByRole('button', { name: /connect paypal/i }));

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/^connected$/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/ending in 6789/i)).toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'PayPal connected' })
    );
    // The secret input is cleared after a successful save.
    expect(screen.getByLabelText(/secret key/i)).toHaveValue('');
  });

  it('shows an inline error when PayPal rejects the credentials', async () => {
    // Arrange
    const user = userEvent.setup();
    savePaypalCredentialsMock.mockRejectedValue(
      new Error(
        'PayPal rejected these credentials. Check the client ID, secret, and environment, then try again.'
      )
    );
    render(<PaypalProviderCard />);
    await screen.findByRole('button', { name: /connect paypal/i });

    // Act
    await fillCredentialForm(user);
    await user.click(screen.getByRole('button', { name: /connect paypal/i }));

    // Assert
    expect(
      await screen.findByText(/paypal rejected these credentials/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/^connected$/i)).not.toBeInTheDocument();
  });

  it('disconnects PayPal after the confirm dialog is accepted', async () => {
    // Arrange
    const user = userEvent.setup();
    mockInitialLoad(connectedStatus);
    deletePaypalCredentialsMock.mockResolvedValue(disconnectedStatus);
    render(<PaypalProviderCard />);
    await screen.findByText(/^connected$/i);

    // Act
    await user.click(
      screen.getByRole('button', { name: /disconnect paypal/i })
    );
    expect(
      await screen.findByRole('heading', { name: /disconnect paypal\?/i })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^disconnect$/i }));

    // Assert
    await waitFor(() => {
      expect(deletePaypalCredentialsMock).toHaveBeenCalledTimes(1);
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'PayPal disconnected' })
    );
  });
});
