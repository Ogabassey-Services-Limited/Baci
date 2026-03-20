interface PaystackFailure {
  error?: string;
  code?: string;
}

export function getPaystackFailureStatus(code?: string): number {
  if (!code) return 502;
  if (code === 'CONFIG_ERROR') return 500;
  if (code === 'VALIDATION_ERROR') return 400;
  if (code === 'NETWORK_ERROR') return 502;
  if (code.startsWith('HTTP_5')) return 502;
  if (code.startsWith('HTTP_4')) return 400;
  return 502;
}

export function getPaystackFailureMessage(
  failure: PaystackFailure,
  fallbackMessage: string
): string {
  if (failure.code === 'CONFIG_ERROR') {
    return 'Service configuration error';
  }

  return failure.error ?? fallbackMessage;
}
