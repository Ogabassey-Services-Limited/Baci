import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';
import {
  getJumiaBaseUrl,
  getJumiaEnvironment,
  JumiaApiError,
  type JumiaEnvironment,
  TOKEN_REFRESH_BUFFER_MS,
} from '@/lib/jumia/helpers';
import {
  loadJumiaIntegrationConfig,
  loadSingleJumiaMerchantIntegrationConfig,
} from '@/lib/jumia/jumia-client-config';
import { waitForJumiaRequestSlot } from '@/lib/jumia/jumia-rate-limiter';
import { createAdminClient } from '@/lib/supabase/admin';
import type { JumiaShop } from '@/schemas/jumia';
import {
  JumiaShopsResponseSchema,
  JumiaTokenResponseSchema,
} from '@/schemas/jumia';

export { JumiaApiError, jumiaErrorResponse } from '@/lib/jumia/helpers';

const REQUEST_TIMEOUT_MS = 30_000;
const MISSING_REFRESH_TOKEN_SYNC_ERROR =
  'Reconnect Jumia to resume syncing. Jumia did not return a refresh token for this OAuth connection.';
type JumiaRequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export class JumiaClient {
  readonly integrationId: string;
  readonly merchantId: string;
  readonly shopId: string;
  private accessToken: string | null;
  private tokenExpiresAt: Date | null;
  private refreshToken: string;
  private environment: JumiaEnvironment;
  private supabase: SupabaseClient | null;

  constructor(config: {
    integrationId: string;
    merchantId: string;
    shopId: string;
    accessToken: string | null;
    refreshToken: string;
    tokenExpiresAt: Date | null;
    environment?: JumiaEnvironment;
    supabase?: SupabaseClient;
  }) {
    this.integrationId = config.integrationId;
    this.merchantId = config.merchantId;
    this.shopId = config.shopId;
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.tokenExpiresAt = config.tokenExpiresAt;
    this.environment = config.environment ?? getJumiaEnvironment();
    this.supabase = config.supabase ?? null;
  }

  static async forIntegration(
    supabase: SupabaseClient,
    merchantId: string,
    integrationId: string
  ): Promise<JumiaClient> {
    return new JumiaClient(
      await loadJumiaIntegrationConfig(supabase, merchantId, integrationId)
    );
  }

  static async forMerchant(
    supabase: SupabaseClient,
    merchantId: string
  ): Promise<JumiaClient> {
    return new JumiaClient(
      await loadSingleJumiaMerchantIntegrationConfig(supabase, merchantId)
    );
  }

  get apiBase(): string {
    return getJumiaBaseUrl(this.environment);
  }

  private needsRefresh(): boolean {
    if (!this.accessToken || !this.tokenExpiresAt) return true;
    return (
      Date.now() >= this.tokenExpiresAt.getTime() - TOKEN_REFRESH_BUFFER_MS
    );
  }

  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken?.trim()) {
      const sb = this.supabase ?? createAdminClient();
      const { error: updateError } = await sb
        .from('marketplace_integrations')
        .update({ sync_error: MISSING_REFRESH_TOKEN_SYNC_ERROR })
        .eq('id', this.integrationId)
        .eq('merchant_id', this.merchantId);

      throw new JumiaApiError(
        401,
        MISSING_REFRESH_TOKEN_SYNC_ERROR,
        updateError ?? undefined
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await this.fetchWithThrottle(`${this.apiBase}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: process.env.JUMIA_CLIENT_ID || '',
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new JumiaApiError(
          response.status,
          'Token refresh failed',
          await response.text()
        );
      }

      const json = await response.json();
      const data = JumiaTokenResponseSchema.parse(json);

      this.accessToken = data.access_token;
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }
      this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

      const sb = this.supabase ?? createAdminClient();
      const { error: updateError } = await sb
        .from('marketplace_integrations')
        .update({
          access_token: data.access_token,
          refresh_token: data.refresh_token || this.refreshToken,
          token_expires_at: this.tokenExpiresAt.toISOString(),
        })
        .eq('id', this.integrationId)
        .eq('merchant_id', this.merchantId);

      if (updateError) {
        throw new JumiaApiError(
          500,
          `Failed to persist refreshed token for integration ${this.integrationId}`,
          updateError
        );
      }
    } catch (error) {
      if (
        (error instanceof Error || error instanceof DOMException) &&
        error.name === 'AbortError'
      ) {
        throw new JumiaApiError(408, 'Token refresh request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getValidToken(): Promise<string> {
    if (this.needsRefresh()) await this.refreshAccessToken();
    if (!this.accessToken) {
      throw new JumiaApiError(401, 'No access token available');
    }
    return this.accessToken;
  }

  private async fetchWithThrottle(
    url: string,
    init: RequestInit
  ): Promise<Response> {
    await waitForJumiaRequestSlot(this.merchantId);
    return fetch(url, init);
  }

  async request(
    method: JumiaRequestMethod,
    path: string,
    schema?: undefined,
    body?: unknown
  ): Promise<unknown>;
  async request<TSchema extends z.ZodTypeAny>(
    method: JumiaRequestMethod,
    path: string,
    schema: TSchema,
    body?: unknown
  ): Promise<z.infer<TSchema>>;
  async request<TSchema extends z.ZodTypeAny>(
    method: JumiaRequestMethod,
    path: string,
    schema?: TSchema,
    body?: unknown
  ): Promise<unknown> {
    const token = await this.getValidToken();
    const url = `${this.apiBase}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      let response = await this.fetchWithThrottle(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      // Auto-retry on 401 with refreshed token
      if (response.status === 401) {
        await this.refreshAccessToken();
        if (!this.accessToken) {
          throw new JumiaApiError(
            401,
            'Access token is null after refresh — cannot retry request'
          );
        }
        const retryController = new AbortController();
        const retryTimeout = setTimeout(
          () => retryController.abort(),
          REQUEST_TIMEOUT_MS
        );
        try {
          response = await this.fetchWithThrottle(url, {
            method,
            headers: {
              ...headers,
              Authorization: `Bearer ${this.accessToken}`,
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: retryController.signal,
          });
        } finally {
          clearTimeout(retryTimeout);
        }
      }

      if (!response.ok) {
        const text = await response.text();
        throw new JumiaApiError(response.status, text, text);
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new JumiaApiError(
          response.status,
          'Response body is not valid JSON'
        );
      }
      if (schema) {
        return schema.parse(json);
      }
      return json;
    } catch (error) {
      if (error instanceof JumiaApiError) throw error;
      if (
        (error instanceof Error || error instanceof DOMException) &&
        error.name === 'AbortError'
      ) {
        throw new JumiaApiError(408, 'Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getShops(): Promise<JumiaShop[]> {
    const response = await this.request(
      'GET',
      '/shops',
      JumiaShopsResponseSchema
    );
    return response.shops;
  }
}
