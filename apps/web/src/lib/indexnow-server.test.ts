import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSubmitIndexNowUrls } = vi.hoisted(() => ({
  mockSubmitIndexNowUrls: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('./indexnow', () => ({
  DEFAULT_INDEXNOW_ENDPOINT: 'https://api.indexnow.org/indexnow',
  DEFAULT_INDEXNOW_KEY: 'default-indexnow-key',
  submitIndexNowUrls: mockSubmitIndexNowUrls,
}));

import { submitConfiguredIndexNowUrls } from './indexnow-server';

describe('submitConfiguredIndexNowUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('INDEXNOW_ENDPOINT', 'https://indexnow.example/submit');
    vi.stubEnv('INDEXNOW_KEY', 'runtime-indexnow-key');
    mockSubmitIndexNowUrls.mockResolvedValue({ status: 'submitted' });
  });

  it('supplies the server runtime credentials to the transport', async () => {
    await submitConfiguredIndexNowUrls({
      host: 'merchant.example',
      urls: ['https://merchant.example/blog/new-arrivals'],
    });

    expect(mockSubmitIndexNowUrls).toHaveBeenCalledWith({
      endpoint: 'https://indexnow.example/submit',
      host: 'merchant.example',
      key: 'runtime-indexnow-key',
      urls: ['https://merchant.example/blog/new-arrivals'],
    });
  });
});
