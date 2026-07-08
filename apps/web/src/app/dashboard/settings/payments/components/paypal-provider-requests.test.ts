import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPatchMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const fetchWithCsrfMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  apiGet: apiGetMock,
  apiPatch: apiPatchMock,
  apiPost: apiPostMock,
  fetchWithCsrf: fetchWithCsrfMock,
}));

import {
  deletePaypalCredentials,
  loadPaypalCardData,
  persistPaypalFeatureConfig,
  savePaypalCredentials,
  type ToastFn,
} from './paypal-provider-requests';

// `ToastFn` includes the `toast.promise` static method (see use-toast.ts);
// a bare `vi.fn()` doesn't structurally match it, so tests cast their stub.
function createToastMock(): ToastFn {
  return vi.fn() as unknown as ToastFn;
}

const emptyStatus = { configured: false, roles: [] };

describe('loadPaypalCardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates enabled/mode/customSettings and status on success', async () => {
    // Arrange
    apiGetMock
      .mockResolvedValueOnce({
        custom_settings: { paypal_enabled: true, paypal_mode: 'live' },
      })
      .mockResolvedValueOnce({
        configured: true,
        roles: [
          {
            role: 'secret_key',
            environment: 'live',
            last4: '6789',
            isActive: true,
            lastValidatedAt: '2026-07-08T00:00:00.000Z',
            lastValidationError: null,
          },
        ],
      });
    const setStatus = vi.fn();
    const setEnabled = vi.fn();
    const setMode = vi.fn();
    const setCustomSettings = vi.fn();
    const setLoading = vi.fn();
    const toast = createToastMock();

    // Act
    await loadPaypalCardData({
      setStatus,
      setEnabled,
      setMode,
      setCustomSettings,
      setLoading,
      toast,
    });

    // Assert
    expect(setCustomSettings).toHaveBeenCalledWith({
      paypal_enabled: true,
      paypal_mode: 'live',
    });
    expect(setEnabled).toHaveBeenCalledWith(true);
    expect(setMode).toHaveBeenCalledWith('live');
    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({ configured: true })
    );
    expect(setLoading).toHaveBeenCalledWith(false);
    expect(toast).not.toHaveBeenCalled();
  });

  it('toasts and falls back to defaults when a fetch rejects', async () => {
    // Arrange
    apiGetMock
      .mockRejectedValueOnce(new Error('features down'))
      .mockRejectedValueOnce(new Error('status down'));
    const setStatus = vi.fn();
    const setEnabled = vi.fn();
    const setMode = vi.fn();
    const setCustomSettings = vi.fn();
    const setLoading = vi.fn();
    const toast = createToastMock();

    // Act
    await loadPaypalCardData({
      setStatus,
      setEnabled,
      setMode,
      setCustomSettings,
      setLoading,
      toast,
    });

    // Assert
    expect(setCustomSettings).not.toHaveBeenCalled();
    expect(setStatus).not.toHaveBeenCalled();
    expect(setLoading).toHaveBeenCalledWith(false);
    expect(toast).toHaveBeenCalledTimes(2);
  });
});

describe('persistPaypalFeatureConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges the patch into existing custom settings before sending', async () => {
    // Arrange
    apiPatchMock.mockResolvedValue({
      custom_settings: { other_key: 'kept', paypal_enabled: true },
    });

    // Act
    const result = await persistPaypalFeatureConfig(
      { paypal_enabled: true },
      { other_key: 'kept', paypal_enabled: false }
    );

    // Assert
    expect(apiPatchMock).toHaveBeenCalledWith('/api/merchant/features', {
      custom_settings: { other_key: 'kept', paypal_enabled: true },
    });
    expect(result).toEqual({ other_key: 'kept', paypal_enabled: true });
  });

  it('falls back to the locally merged settings when the response omits them', async () => {
    // Arrange
    apiPatchMock.mockResolvedValue({});

    // Act
    const result = await persistPaypalFeatureConfig(
      { paypal_mode: 'live' },
      { paypal_enabled: true }
    );

    // Assert
    expect(result).toEqual({ paypal_enabled: true, paypal_mode: 'live' });
  });
});

describe('savePaypalCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts the provider alongside the credential payload', async () => {
    // Arrange
    apiPostMock.mockResolvedValue({ configured: true, roles: [] });

    // Act
    const result = await savePaypalCredentials({
      environment: 'test',
      clientId: 'client-123456789',
      secretKey: 'secret-123456789',
    });

    // Assert
    expect(apiPostMock).toHaveBeenCalledWith(
      '/api/merchant/payment-credentials',
      {
        provider: 'paypal',
        environment: 'test',
        clientId: 'client-123456789',
        secretKey: 'secret-123456789',
      }
    );
    expect(result).toEqual({ configured: true, roles: [] });
  });

  it('propagates a rejection from the API layer', async () => {
    // Arrange
    apiPostMock.mockRejectedValue(
      new Error('PayPal rejected these credentials.')
    );

    // Act / Assert
    await expect(
      savePaypalCredentials({
        environment: 'test',
        clientId: 'bad',
        secretKey: 'bad',
      })
    ).rejects.toThrow('PayPal rejected these credentials.');
  });
});

describe('deletePaypalCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the provider in the DELETE body and returns the fresh status', async () => {
    // Arrange
    fetchWithCsrfMock.mockResolvedValue({
      ok: true,
      json: async () => emptyStatus,
    });

    // Act
    const result = await deletePaypalCredentials();

    // Assert
    expect(fetchWithCsrfMock).toHaveBeenCalledWith(
      '/api/merchant/payment-credentials',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ provider: 'paypal' }),
      })
    );
    expect(result).toEqual(emptyStatus);
  });

  it('throws the server error message on a non-ok response', async () => {
    // Arrange
    fetchWithCsrfMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Permission denied' }),
    });

    // Act / Assert
    await expect(deletePaypalCredentials()).rejects.toThrow(
      'Permission denied'
    );
  });
});
