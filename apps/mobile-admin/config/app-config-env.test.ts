import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadDotenv } = vi.hoisted(() => ({
  loadDotenv: vi.fn(),
}));

vi.mock('dotenv', () => ({
  config: loadDotenv,
}));

describe('app config environment setup', () => {
  beforeEach(() => {
    vi.resetModules();
    loadDotenv.mockClear();
  });

  it('loads dotenv quietly before Expo config reads process.env', async () => {
    await import('./app-config-env');

    expect(loadDotenv).toHaveBeenCalledTimes(1);
    expect(loadDotenv).toHaveBeenCalledWith({ quiet: true });
  });
});
