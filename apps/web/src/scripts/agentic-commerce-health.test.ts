import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runAgenticCommerceHealthMonitor: vi.fn(),
}));

vi.mock('@/app/api/cron/agentic-commerce-health/route', () => ({
  runAgenticCommerceHealthMonitor: mocks.runAgenticCommerceHealthMonitor,
}));

import { runAgenticCommerceHealthCli } from './agentic-commerce-health';

describe('runAgenticCommerceHealthCli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the health summary and exits cleanly when status is ok', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.runAgenticCommerceHealthMonitor.mockResolvedValue({
      checked_at: '2026-06-12T12:00:00.000Z',
      merchant_count: 1,
      merchants: [],
      status: 'ok',
      support_chat: { status: 'ok' },
    });

    const exitCode = await runAgenticCommerceHealthCli();

    expect(exitCode).toBe(0);
    expect(mocks.runAgenticCommerceHealthMonitor).toHaveBeenCalledWith({
      includeSupportChat: false,
    });
    expect(JSON.parse(logSpy.mock.calls[0]?.[0] ?? '{}')).toMatchObject({
      merchant_count: 1,
      status: 'ok',
    });
  });

  it('returns non-zero when the monitor needs attention', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.runAgenticCommerceHealthMonitor.mockResolvedValue({
      checked_at: '2026-06-12T12:00:00.000Z',
      merchant_count: 1,
      merchants: [{ slug: 'ogabassey', status: 'attention' }],
      status: 'attention',
      support_chat: { status: 'ok' },
    });

    const exitCode = await runAgenticCommerceHealthCli();

    expect(exitCode).toBe(1);
    expect(JSON.parse(logSpy.mock.calls[0]?.[0] ?? '{}')).toMatchObject({
      status: 'attention',
    });
  });

  it('can opt into the support chat probe when explicitly enabled', async () => {
    vi.stubEnv('AGENTIC_HEALTH_INCLUDE_SUPPORT_CHAT', 'true');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.runAgenticCommerceHealthMonitor.mockResolvedValue({
      checked_at: '2026-06-12T12:00:00.000Z',
      merchant_count: 1,
      merchants: [],
      status: 'ok',
      support_chat: { status: 'ok' },
    });

    const exitCode = await runAgenticCommerceHealthCli();

    expect(exitCode).toBe(0);
    expect(mocks.runAgenticCommerceHealthMonitor).toHaveBeenCalledWith({
      includeSupportChat: true,
    });
  });
});
