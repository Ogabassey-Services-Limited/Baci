import { describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

describe('dotenv-config', () => {
  it('loads dotenv without banner output', async () => {
    vi.resetModules();
    const dotenv = await import('dotenv');
    vi.mocked(dotenv.config).mockReset();

    await import('./dotenv-config');

    expect(vi.mocked(dotenv.config)).toHaveBeenCalledWith({ quiet: true });
  });

  it('propagates dotenv config errors', async () => {
    vi.resetModules();
    const dotenv = await import('dotenv');
    vi.mocked(dotenv.config).mockReset();
    vi.mocked(dotenv.config).mockImplementationOnce(() => {
      throw new Error('dotenv config failed');
    });

    await expect(import('./dotenv-config')).rejects.toThrow(
      'dotenv config failed'
    );
  });
});
