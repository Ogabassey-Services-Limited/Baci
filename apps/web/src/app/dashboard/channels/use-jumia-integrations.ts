'use client';

import { useEffect, useState } from 'react';
import { buildCsrfHeaders } from '@/lib/csrf';

export interface JumiaIntegration {
  id: string;
  shop_id: string;
  shop_name: string;
  country_code: string;
  is_active: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
}

export function useJumiaIntegrations() {
  const [integrations, setIntegrations] = useState<JumiaIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch('/api/marketplace/jumia/connect');
      if (!response.ok) return;
      const data = await response.json();
      setIntegrations(data.integrations || []);
    } catch {
      // Silently fail — caller handles UI feedback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  return { integrations, setIntegrations, loading, refetch: fetchIntegrations };
}

export async function connectWithToken(
  refreshToken: string,
  shopName: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('/api/marketplace/jumia/connect', {
      method: 'POST',
      headers: buildCsrfHeaders({ 'Content-Type': 'application/json' }),
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
    const response = await fetch(
      `/api/marketplace/jumia/connect?id=${integrationId}`,
      { method: 'DELETE', headers: buildCsrfHeaders() }
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
    const response = await fetch(
      `/api/marketplace/jumia/orders?integrationId=${encodeURIComponent(integrationId)}`,
      { method: 'POST', headers: buildCsrfHeaders() }
    );
    const data = await response.json();
    if (!response.ok) {
      const detail = data.details
        ? `${data.error}\nDetails: ${data.details}`
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
