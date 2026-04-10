'use client';

import { useEffect, useState } from 'react';
import { fetchWithCsrf } from '@/lib/api-client';

export interface JumiaIntegration {
  id: string;
  shop_id: string;
  shop_name: string;
  country_code: string;
  is_active: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
}

async function fetchJumiaIntegrations(): Promise<{
  integrations: JumiaIntegration[];
  error: string | null;
}> {
  try {
    const response = await fetch('/api/marketplace/jumia/connect');
    if (!response.ok) {
      return {
        integrations: [],
        error: `Failed to load integrations (${response.status})`,
      };
    }
    const data = await response.json();
    return { integrations: data.integrations || [], error: null };
  } catch {
    return {
      integrations: [],
      error: 'Failed to load integrations — please try again',
    };
  }
}

export function useJumiaIntegrations() {
  const [integrations, setIntegrations] = useState<JumiaIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchJumiaIntegrations().then((result) => {
      if (cancelled) return;
      setIntegrations(result.integrations);
      setError(result.error);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const refetch = async (): Promise<JumiaIntegration[]> => {
    setLoading(true);
    setError(null);
    const result = await fetchJumiaIntegrations();
    setIntegrations(result.integrations);
    setError(result.error);
    setLoading(false);
    return result.integrations;
  };

  return { integrations, setIntegrations, loading, error, refetch };
}

export async function connectWithToken(
  refreshToken: string,
  shopName: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetchWithCsrf('/api/marketplace/jumia/connect', {
      method: 'POST',
      body: JSON.stringify({
        connectionType: 'self_authorization',
        refreshToken: refreshToken.trim(),
        shopName: shopName.trim() || 'My Jumia Shop',
        countryCode: 'NG',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.error || 'Connection failed' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Connection failed — please try again' };
  }
}

export async function disconnectIntegration(
  integrationId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetchWithCsrf(
      `/api/marketplace/jumia/connect?id=${encodeURIComponent(integrationId)}`,
      { method: 'DELETE' }
    );
    if (!response.ok) {
      return { ok: false, error: 'Failed to disconnect' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Failed to disconnect' };
  }
}

export async function syncOrders(
  integrationId: string
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const response = await fetchWithCsrf(
      `/api/marketplace/jumia/orders?integrationId=${encodeURIComponent(integrationId)}`,
      { method: 'POST' }
    );
    const data = await response.json();
    if (!response.ok) {
      const detail = data.details
        ? `${data.error || 'Sync failed'}\nDetails: ${data.details}`
        : data.error || 'Sync failed';
      return { ok: false, error: detail };
    }
    return {
      ok: true,
      message: `Synced ${data.synced} orders (${data.newOrders} new)`,
    };
  } catch {
    return { ok: false, error: 'Sync failed — please try again' };
  }
}

export async function syncStock(
  integrationId: string
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const response = await fetchWithCsrf(
      `/api/marketplace/jumia/products/stock?integrationId=${encodeURIComponent(integrationId)}`,
      { method: 'POST' }
    );
    const data = await response.json();
    if (!response.ok) {
      const detail = data.details
        ? `${data.error || 'Stock sync failed'}\nDetails: ${data.details}`
        : data.error || 'Stock sync failed';
      return { ok: false, error: detail };
    }
    return { ok: true, message: data.message || 'Stock synced' };
  } catch {
    return { ok: false, error: 'Stock sync failed — please try again' };
  }
}
