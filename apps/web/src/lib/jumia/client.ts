/**
 * Jumia Vendor Center API Client — Core
 *
 * Handles authentication, token refresh, and generic API requests.
 * Domain-specific methods live in submodules (catalog, orders, fulfillment, feeds).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';
import {
  getJumiaBaseUrl,
  getJumiaEnvironment,
  JumiaApiError,
  type JumiaEnvironment,
  TOKEN_REFRESH_BUFFER_MS,
} from '@/lib/jumia/helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import type { JumiaShop } from '@/schemas/jumia';
import {
  JumiaShopsResponseSchema,
  JumiaTokenResponseSchema,
} from '@/schemas/jumia';

export { JumiaApiError, jumiaErrorResponse } from '@/lib/jumia/helpers';

// ── Integration columns selected from marketplace_integrations ──

const INTEGRATION_COLUMNS =
  'id, merchant_id, shop_id, shop_name, country_code, access_token, refresh_token, token_expires_at, is_active' as const;

// ── Rate limiting ──
// Jumia Vendor Center: 200 req/min, 4 req/sec at MasterShop level.
// Enforce min 250ms between requests per client instance.

const MIN_REQUEST_INTERVAL_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Client ──

export class JumiaClient {
  readonly integrationId: string;
  readonly merchantId: string;
  readonly shopId: string;
  private accessToken: string | null;
  private tokenExpiresAt: Date | null;
  private refreshToken: string;
  private environment: JumiaEnvironment;
  private supabase: SupabaseClient | null;
  private lastRequestAt: number;
  private requestGate: Promise<void>;

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
    this.lastRequestAt = 0;
    this.requestGate = Promise.resolve();
  }

  // ── Factory: load by integration ID (scoped to merchant) ──

  static async forIntegration(
    supabase: SupabaseClient,
    merchantId: string,
    integrationId: string
  ): Promise<JumiaClient> {
    const { data, error } = await supabase
      .from('marketplace_integrations')
      .select(INTEGRATION_COLUMNS)
      .eq('id', integrationId)
      .eq('merchant_id', merchantId)
      .eq('platform', 'jumia')
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new JumiaApiError(
        404,
        `Jumia integration not found: ${integrationId}`
      );
    }

    return new JumiaClient({
      integrationId: data.id,
      merchantId: data.merchant_id,
      shopId: data.shop_id || 'oauth',
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      tokenExpiresAt: data.token_expires_at
        ? new Date(data.token_expires_at)
        : null,
      supabase,
    });
  }

  // ── Factory: load single integration for merchant ──

  static async forMerchant(
    supabase: SupabaseClient,
    merchantId: string
  ): Promise<JumiaClient> {
    const { data, error } = await supabase
      .from('marketplace_integrations')
      .select(INTEGRATION_COLUMNS)
      .eq('merchant_id', merchantId)
      .eq('platform', 'jumia')
      .eq('is_active', true)
      .limit(2);

    if (error || !data || data.length === 0) {
      throw new JumiaApiError(404, 'No active Jumia integration found');
    }

    if (data.length > 1) {
      throw new JumiaApiError(
        400,
        `Multiple active Jumia integrations found for merchant ${merchantId}. Use forIntegration() with a specific integrationId.`
      );
    }

    const row = data[0];
    return new JumiaClient({
      integrationId: row.id,
      merchantId: row.merchant_id,
      shopId: row.shop_id || 'oauth',
      accessToken: row.access_token,
      refreshToken: row.refresh_token || '',
      tokenExpiresAt: row.token_expires_at
        ? new Date(row.token_expires_at)
        : null,
      supabase,
    });
  }

  // ── Token management ──

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
    const response = await fetch(`${this.apiBase}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: process.env.JUMIA_CLIENT_ID || '',
      }),
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
  }

  async getValidToken(): Promise<string> {
    if (this.needsRefresh()) await this.refreshAccessToken();
    if (!this.accessToken) {
      throw new JumiaApiError(401, 'No access token available');
    }
    return this.accessToken;
  }

  private async awaitRequestSlot(): Promise<void> {
    const previousGate = this.requestGate;
    let releaseGate: (() => void) | null = null;

    this.requestGate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });

    await previousGate;

    try {
      const elapsed = Date.now() - this.lastRequestAt;
      if (elapsed < MIN_REQUEST_INTERVAL_MS) {
        await sleep(MIN_REQUEST_INTERVAL_MS - elapsed);
      }
      this.lastRequestAt = Date.now();
    } finally {
      releaseGate?.();
    }
  }

  private async fetchWithThrottle(
    url: string,
    init: RequestInit
  ): Promise<Response> {
    await this.awaitRequestSlot();
    return fetch(url, init);
  }

  // ── Generic request ──

  async request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    schema?: undefined,
    body?: unknown
  ): Promise<unknown>;
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    schema: z.ZodSchema<T>,
    body?: unknown
  ): Promise<T>;
  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    schema?: z.ZodSchema<T>,
    body?: unknown
  ): Promise<T | unknown> {
    const token = await this.getValidToken();
    const url = `${this.apiBase}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

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
        const retryTimeout = setTimeout(() => retryController.abort(), 30_000);
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
      return schema ? schema.parse(json) : json;
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

  // ── Shops ──

  async getShops(): Promise<JumiaShop[]> {
    return (await this.request('GET', '/shops', JumiaShopsResponseSchema))
      .shops;
  }
}
