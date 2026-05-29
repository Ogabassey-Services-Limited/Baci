import type { ErrorInfo } from 'react';
import { createLogger } from '@/lib/logger';

const log = createLogger('ErrorBoundary');

export type ErrorType = 'network' | 'auth' | 'supabase' | 'general';
export type ErrorIconName =
  | 'alert-circle-outline'
  | 'wifi-outline'
  | 'server-outline'
  | 'log-in-outline';

export interface ErrorContent {
  icon: ErrorIconName;
  title: string;
  message: string;
  buttonText: string;
}

const ERROR_CONTENT: Record<ErrorType, ErrorContent> = {
  network: {
    icon: 'wifi-outline',
    title: 'Connection Error',
    message:
      'Unable to connect to the server. Please check your internet connection and try again.',
    buttonText: 'Retry',
  },
  auth: {
    icon: 'log-in-outline',
    title: 'Session Expired',
    message: 'Your session has expired. Please sign in again to continue.',
    buttonText: 'Sign In',
  },
  supabase: {
    icon: 'server-outline',
    title: 'Service Unavailable',
    message:
      'Our servers are temporarily unavailable. Please try again in a moment.',
    buttonText: 'Try Again',
  },
  general: {
    icon: 'alert-circle-outline',
    title: 'Something Went Wrong',
    message:
      'An unexpected error occurred. We apologize for the inconvenience.',
    buttonText: 'Retry',
  },
};

const NETWORK_ERROR_CODES = new Set([
  'NETWORK_ERROR',
  'TIMEOUT_ERROR',
  'FETCH_ERROR',
]);
const AUTH_ERROR_CODES = new Set(['AUTH_ERROR']);
const SERVER_ERROR_CODES = new Set(['SERVER_ERROR']);

function getErrorCode(error: Error): string | undefined {
  if (
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

export function classifyError(error: Error): ErrorType {
  const code = getErrorCode(error);
  if (code) {
    if (NETWORK_ERROR_CODES.has(code)) return 'network';
    if (AUTH_ERROR_CODES.has(code)) return 'auth';
    if (SERVER_ERROR_CODES.has(code)) return 'supabase';
  }

  const msg = error.message.toLowerCase();
  if (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('failed to fetch') ||
    msg.includes('no internet')
  ) {
    return 'network';
  }

  if (
    msg.includes('supabase') ||
    msg.includes('postgresterror') ||
    msg.includes('autherror') ||
    msg.includes('pgrst')
  ) {
    return 'supabase';
  }

  return 'general';
}

export function getErrorContent(errorType: ErrorType): ErrorContent {
  return ERROR_CONTENT[errorType];
}

export function logError(
  error: Error,
  errorInfo?: ErrorInfo,
  context?: string
): void {
  const timestamp = new Date().toISOString();
  const errorReport = {
    timestamp,
    context: context || 'ErrorBoundary',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    componentStack: errorInfo?.componentStack,
  };

  log.error('Error caught', errorReport);
}
