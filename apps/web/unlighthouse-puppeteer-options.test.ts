import { describe, expect, it } from 'vitest';
import { getUnlighthousePuppeteerOptions } from './unlighthouse-puppeteer-options';

describe('getUnlighthousePuppeteerOptions', () => {
  it('uses the workflow-provided Chrome path when available', () => {
    const options = getUnlighthousePuppeteerOptions({
      PUPPETEER_EXECUTABLE_PATH: '/tmp/chrome',
    });

    expect(options).toEqual({
      executablePath: '/tmp/chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  it('returns the no-sandbox CI args even when no explicit Chrome path is provided', () => {
    const options = getUnlighthousePuppeteerOptions({});

    expect(options).toEqual({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  it('always includes --no-sandbox so Ubuntu 24.04 AppArmor-restricted hosts can launch Chrome', () => {
    const withPath = getUnlighthousePuppeteerOptions({
      PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium',
    });
    const withoutPath = getUnlighthousePuppeteerOptions({});

    expect(withPath.args).toContain('--no-sandbox');
    expect(withoutPath.args).toContain('--no-sandbox');
  });
});
