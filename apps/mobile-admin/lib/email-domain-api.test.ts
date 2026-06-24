import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockApiClient } = vi.hoisted(() => ({ mockApiClient: vi.fn() }));
vi.mock('./api-client', () => ({ apiClient: mockApiClient }));

import {
  getEmailDomain,
  registerEmailDomain,
  setEmailDomainEnabled,
  verifyEmailDomain,
} from './email-domain-api';

const CONFIG = {
  domain: 'mystore.com',
  senderLocalPart: 'noreply',
  status: 'pending',
  enabled: false,
  records: [{ type: 'TXT', host: 'h', value: 'v' }],
};

describe('email-domain-api', () => {
  beforeEach(() => {
    mockApiClient.mockReset();
    mockApiClient.mockResolvedValue({ domain: CONFIG });
  });

  it('getEmailDomain GETs the endpoint and unwraps the domain', async () => {
    await expect(getEmailDomain()).resolves.toEqual(CONFIG);
    expect(mockApiClient).toHaveBeenCalledWith('/api/merchant/email-domain');
  });

  it('registerEmailDomain POSTs the domain', async () => {
    await registerEmailDomain('mystore.com');
    expect(mockApiClient).toHaveBeenCalledWith('/api/merchant/email-domain', {
      method: 'POST',
      body: JSON.stringify({ domain: 'mystore.com' }),
    });
  });

  it('verifyEmailDomain POSTs the verify endpoint', async () => {
    await verifyEmailDomain();
    expect(mockApiClient).toHaveBeenCalledWith(
      '/api/merchant/email-domain/verify',
      { method: 'POST' }
    );
  });

  it('setEmailDomainEnabled PATCHes the enabled flag', async () => {
    await setEmailDomainEnabled(true);
    expect(mockApiClient).toHaveBeenCalledWith('/api/merchant/email-domain', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: true }),
    });
  });

  it('returns null when there is no domain configured', async () => {
    mockApiClient.mockResolvedValue({ domain: null });
    await expect(getEmailDomain()).resolves.toBeNull();
  });
});
