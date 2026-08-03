import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveSantaTenant: vi.fn(),
}));

vi.mock('@/lib/agentic/resolve-santa-tenant', () => ({
  resolveSantaTenant: mocks.resolveSantaTenant,
}));

import { SANTA_MERCHANT_SLUG_HEADER } from '@/lib/agentic/santa-merchant-slug-header';
import { resolveChatTenant, withChatTenantHeader } from './chat-tenant';

describe('chat tenant helpers', () => {
  it('passes the request signal to the shared tenant resolver', async () => {
    const controller = new AbortController();
    const tenant = {
      id: 'merchant-1',
      slug: 'winter-store',
      businessName: 'Winter Store',
    };
    mocks.resolveSantaTenant.mockResolvedValueOnce(tenant);

    await expect(resolveChatTenant(controller.signal)).resolves.toEqual(tenant);
    expect(mocks.resolveSantaTenant).toHaveBeenCalledWith(controller.signal);
  });

  it('adds the resolved merchant slug to a response', () => {
    const response = withChatTenantHeader(new Response('ok'), 'winter-store');

    expect(response.headers.get(SANTA_MERCHANT_SLUG_HEADER)).toBe(
      'winter-store'
    );
  });
});
