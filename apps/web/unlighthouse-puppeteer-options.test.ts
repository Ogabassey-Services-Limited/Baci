import { describe, expect, it } from 'vitest';
import { getUnlighthousePuppeteerOptions } from './unlighthouse-puppeteer-options';

describe('getUnlighthousePuppeteerOptions', () => {
  it('uses the workflow-provided Chrome path when available', () => {
    const options = getUnlighthousePuppeteerOptions({
      PUPPETEER_EXECUTABLE_PATH: '/tmp/chrome',
    });

    expect(options).toEqual({
      executablePath: '/tmp/chrome',
    });
  });

  it('leaves puppeteer options empty when no explicit Chrome path is provided', () => {
    const options = getUnlighthousePuppeteerOptions({});

    expect(options).toEqual({});
  });
});
