import type { LogHandler } from 'react-native-purchases';

interface RevenueCatLogger {
  setLogHandler(handler: LogHandler): void;
}

export function configureRevenueCatDevelopmentLogging(
  purchases: RevenueCatLogger,
  isDevelopment: boolean = __DEV__
) {
  if (!isDevelopment) return;

  purchases.setLogHandler((level, message) => {
    const formattedMessage = `[RevenueCat][${level}] ${message}`;
    if (level === 'ERROR' || level === 'WARN' || level === 'INFO') {
      console.info(formattedMessage);
      return;
    }
    console.debug(formattedMessage);
  });
}
