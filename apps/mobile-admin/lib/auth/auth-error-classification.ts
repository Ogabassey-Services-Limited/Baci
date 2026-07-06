export type AuthErrorKind = 'terminal' | 'transient';

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
};

function asErrorLike(error: unknown): ErrorLike {
  if (error && typeof error === 'object') {
    return error as ErrorLike;
  }

  return {};
}

function getStringProperty(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function getAuthErrorCode(error: unknown): string | null {
  const errorLike = asErrorLike(error);
  const explicitCode = getStringProperty(errorLike.code);
  if (explicitCode) {
    return explicitCode;
  }

  const name = getStringProperty(errorLike.name);
  if (name) {
    return name;
  }

  if (typeof errorLike.status === 'number') {
    return String(errorLike.status);
  }

  return null;
}

export function classifyAuthError(error: unknown): AuthErrorKind {
  const errorLike = asErrorLike(error);
  const code = getAuthErrorCode(error)?.toLowerCase() ?? '';
  const message = getStringProperty(errorLike.message)?.toLowerCase() ?? '';
  const name = getStringProperty(errorLike.name)?.toLowerCase() ?? '';

  if (
    code === 'invalid_grant' ||
    code === 'session_not_found' ||
    code === 'refresh_token_not_found' ||
    code === 'refresh_token_already_used' ||
    code === 'user_not_found' ||
    name === 'authsessionmissingerror' ||
    message.includes('refresh token') ||
    message.includes('invalid_grant')
  ) {
    return 'terminal';
  }

  return 'transient';
}
