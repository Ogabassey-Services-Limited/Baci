import type { z } from 'zod';
import {
  GIGL_EMAIL,
  GIGL_PASSWORD,
  GIGL_TOKEN_EXPIRY_MS,
  type GiglApiEnvelope,
  type GiglFetchOptions,
  type GiglProviderIo,
  type GiglToken,
  getConfiguredGiglBaseUrl,
  withGiglTokenRequestTimeout,
} from './gigl.constants';
import { giglSchemas } from './gigl.schemas';

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeCustomerType(...values: unknown[]): number {
  for (const value of values) {
    const customerType = readNumber(value);
    if (customerType !== undefined) {
      return customerType;
    }
  }

  return 0;
}

function unwrapApiEnvelope(payload: unknown): GiglApiEnvelope {
  const parsed = giglSchemas.envelopeObject.safeParse(payload);

  if (!parsed.success) {
    return {
      status: 500,
      data: payload,
    };
  }

  const outer = parsed.data;
  const nestedEnvelope = giglSchemas.envelopeObject.safeParse(outer.data);
  if (
    nestedEnvelope.success &&
    (nestedEnvelope.data.data !== undefined ||
      nestedEnvelope.data.status !== undefined ||
      nestedEnvelope.data.message !== undefined)
  ) {
    return {
      status: nestedEnvelope.data.status ?? outer.status ?? 200,
      message: nestedEnvelope.data.message || outer.message,
      data: nestedEnvelope.data.data,
    };
  }

  return {
    status: outer.status ?? 200,
    message: outer.message,
    data: outer.data,
  };
}

function isAuthRejectedResponseStatus(status: number): boolean {
  return status === 401 || status === 403;
}

function isAuthRejectedEnvelope(envelope: GiglApiEnvelope): boolean {
  if (isAuthRejectedResponseStatus(envelope.status)) {
    return true;
  }

  if (envelope.status >= 200 && envelope.status < 300) {
    return false;
  }

  const message = envelope.message?.toLowerCase() ?? '';
  return [
    'wrong authentication credentials',
    'unauthorized',
    'unauthorised',
    'invalid token',
    'expired token',
    'token expired',
    'authentication failed',
    'authentication required',
    'authorization failed',
    'authorization required',
  ].some((authFailure) => message.includes(authFailure));
}

export class GiglApiClient {
  private cachedToken: GiglToken | null = null;
  private tokenRequest: Promise<GiglToken> | null = null;

  constructor(private readonly io: GiglProviderIo) {}

  get currentToken(): GiglToken | null {
    return this.cachedToken;
  }

  get baseUrl(): string {
    return getConfiguredGiglBaseUrl();
  }

  parseEnvelopeData<T>(
    envelope: GiglApiEnvelope,
    schema: z.ZodType<T>,
    description: string
  ): T {
    const parsed = schema.safeParse(envelope.data);
    if (!parsed.success) {
      this.io.log('warn', `Invalid GIGL ${description} response`, {
        status: envelope.status,
        apiMessage: envelope.message,
        issues: parsed.error.issues,
      });
      throw new Error(`Invalid GIGL ${description} response`);
    }

    return parsed.data;
  }

  getApiToken(timeout?: number, signal?: AbortSignal): Promise<GiglToken> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return Promise.resolve(this.cachedToken);
    }

    if (this.tokenRequest) {
      return withGiglTokenRequestTimeout(this.tokenRequest, timeout, signal);
    }

    this.tokenRequest = this.fetchApiToken().finally(() => {
      this.tokenRequest = null;
    });
    void this.tokenRequest.catch(() => undefined);

    return withGiglTokenRequestTimeout(this.tokenRequest, timeout, signal);
  }

  async safeFetchEnvelopeWithAccessToken(
    url: string,
    tokenData: GiglToken,
    buildRequest: (tokenData: GiglToken) => GiglFetchOptions
  ): Promise<{
    envelope: GiglApiEnvelope | null;
    response: Response;
    tokenData: GiglToken;
  }> {
    let result = await this.safeFetchWithAccessToken(
      url,
      tokenData,
      buildRequest
    );

    if (!result.response.ok) {
      return { ...result, envelope: null };
    }

    let envelope = unwrapApiEnvelope(await result.response.json());
    if (!isAuthRejectedEnvelope(envelope)) {
      return { ...result, envelope };
    }

    this.io.log(
      'warn',
      'GIGL token rejected in API envelope; refreshing token',
      {
        status: envelope.status,
        apiMessage: envelope.message,
      }
    );
    this.invalidateCachedToken(result.tokenData.token);

    const retryOptions = buildRequest(result.tokenData);
    const refreshedToken = await this.getApiToken(
      retryOptions.timeout,
      retryOptions.signal ?? undefined
    );
    result = await this.safeFetchWithAccessToken(
      url,
      refreshedToken,
      buildRequest
    );

    if (!result.response.ok) {
      return { ...result, envelope: null };
    }

    envelope = unwrapApiEnvelope(await result.response.json());
    return { ...result, envelope };
  }

  private async fetchApiToken(): Promise<GiglToken> {
    this.io.log('info', 'Fetching new GIGL API token');

    if (!GIGL_EMAIL || !GIGL_PASSWORD) {
      throw new Error('GIGL credentials not configured');
    }

    const response = await this.io.safeFetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: GIGL_EMAIL, password: GIGL_PASSWORD }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.io.log('error', 'GIGL login failed', {
        status: response.status,
        error,
      });
      throw new Error('GIGL API authentication failed');
    }

    const envelope = unwrapApiEnvelope(await response.json());

    if (envelope.status !== 200) {
      this.io.log('warn', 'Invalid GIGL login response', {
        status: envelope.status,
        apiMessage: envelope.message,
      });
      throw new Error('Invalid GIGL login response');
    }

    const loginData = this.parseEnvelopeData(
      envelope,
      giglSchemas.loginData,
      'login'
    );

    this.cachedToken = {
      token: loginData['access-token'],
      userChannelCode: loginData.UserChannelCode,
      customerType: normalizeCustomerType(
        loginData?.CustomerType,
        loginData?.UserChannelType
      ),
      expiresAt: Date.now() + GIGL_TOKEN_EXPIRY_MS,
    };

    return this.cachedToken;
  }

  private invalidateCachedToken(token?: string): void {
    if (!token || this.cachedToken?.token === token) {
      this.cachedToken = null;
    }
  }

  private async safeFetchWithAccessToken(
    url: string,
    tokenData: GiglToken,
    buildRequest: (tokenData: GiglToken) => GiglFetchOptions
  ): Promise<{ response: Response; tokenData: GiglToken }> {
    const withAccessToken = (options: GiglFetchOptions, token: string) => {
      const headers = new Headers(options.headers);
      headers.set('access-token', token);

      return {
        ...options,
        headers,
      };
    };

    const initialOptions = buildRequest(tokenData);
    let response = await this.io.safeFetch(
      url,
      withAccessToken(initialOptions, tokenData.token)
    );

    if (!isAuthRejectedResponseStatus(response.status)) {
      return { response, tokenData };
    }

    this.io.log('warn', 'GIGL token rejected; refreshing token', {
      status: response.status,
    });
    this.invalidateCachedToken(tokenData.token);

    const refreshedToken = await this.getApiToken(
      initialOptions.timeout,
      initialOptions.signal ?? undefined
    );
    response = await this.io.safeFetch(
      url,
      withAccessToken(buildRequest(refreshedToken), refreshedToken.token)
    );

    return { response, tokenData: refreshedToken };
  }
}
