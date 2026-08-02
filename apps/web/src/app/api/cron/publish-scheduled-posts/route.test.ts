import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCronRequest,
  GET,
  mockSupabase,
  POST,
  resetCronRouteMocks,
} from './route.test-support';

describe('scheduled-post publishing cron authentication', () => {
  beforeEach(resetCronRouteMocks);
  afterEach(() => vi.unstubAllEnvs());

  it('returns 401 when the cron secret is invalid', async () => {
    const response = await POST(
      new Request('http://localhost/api/cron/publish-scheduled-posts', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-secrex' },
      })
    );
    expect(response.status).toBe(401);
  });

  it('accepts lowercase bearer authorization for cron authentication', async () => {
    mockSupabase.lte.mockResolvedValue({ data: [], error: null });
    const response = await POST(
      new Request('http://localhost/api/cron/publish-scheduled-posts', {
        method: 'POST',
        headers: { authorization: 'bearer test-secret' },
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: 'No posts to publish',
    });
  });

  it('supports authenticated manual GET invocation', async () => {
    mockSupabase.lte.mockResolvedValue({ data: [], error: null });
    const response = await GET(createCronRequest('GET'));
    expect(response.status).toBe(200);
  });
});
