export class NetworkError extends Error {
  public readonly isTimeout: boolean;
  public readonly isOffline: boolean;
  public readonly statusCode?: number;
  public readonly data?: unknown;

  constructor(
    message: string,
    options: {
      isTimeout?: boolean;
      isOffline?: boolean;
      statusCode?: number;
      data?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'NetworkError';
    this.isTimeout = options.isTimeout ?? false;
    this.isOffline = options.isOffline ?? false;
    this.statusCode = options.statusCode;
    this.data = options.data;
  }
}

export function getResponseErrorMessage(data: unknown, status: number): string {
  if (typeof data === 'string' && data) {
    return data;
  }

  if (data && typeof data === 'object') {
    if ('message' in data && typeof data.message === 'string') {
      return data.message;
    }

    if ('error' in data && typeof data.error === 'string') {
      return data.error;
    }
  }

  return `Request failed with status ${status}`;
}
