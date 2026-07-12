import type { LOG_LEVEL } from 'react-native-purchases';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureRevenueCatDevelopmentLogging } from './revenueCatDevelopmentLogging';

const logLevel = {
  DEBUG: 'DEBUG' as LOG_LEVEL,
  ERROR: 'ERROR' as LOG_LEVEL,
  INFO: 'INFO' as LOG_LEVEL,
  WARN: 'WARN' as LOG_LEVEL,
};

describe('configureRevenueCatDevelopmentLogging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps development errors visible without opening LogBox', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const setLogHandler = vi.fn();

    configureRevenueCatDevelopmentLogging({ setLogHandler }, true);
    const handler = setLogHandler.mock.calls[0]?.[0];
    handler?.(logLevel.ERROR, 'Temporary backend failure');

    expect(info).toHaveBeenCalledWith(
      '[RevenueCat][ERROR] Temporary backend failure'
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    [logLevel.WARN, 'info'],
    [logLevel.INFO, 'info'],
    [logLevel.DEBUG, 'debug'],
  ] as const)('routes %s messages to console.%s', (level, consoleMethod) => {
    const logger = vi
      .spyOn(console, consoleMethod)
      .mockImplementation(() => undefined);
    const setLogHandler = vi.fn();

    configureRevenueCatDevelopmentLogging({ setLogHandler }, true);
    const handler = setLogHandler.mock.calls[0]?.[0];
    handler?.(level, 'SDK message');

    expect(setLogHandler).toHaveBeenCalledOnce();
    expect(logger).toHaveBeenCalledWith(`[RevenueCat][${level}] SDK message`);
  });

  it('preserves the native default logger in production', () => {
    const setLogHandler = vi.fn();

    configureRevenueCatDevelopmentLogging({ setLogHandler }, false);

    expect(setLogHandler).not.toHaveBeenCalled();
  });
});
