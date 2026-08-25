'use client';

import {
  AlertCircle,
  Check,
  ListRestart,
  Loader2,
  RefreshCcw,
} from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  type AdsSyncWindow,
  buildAdsSyncWindowChunks,
  buildDefaultAdsSyncWindow,
} from '@/lib/analytics/default-ads-sync-window';
import { fetchWithCsrf } from '@/lib/api-client';
import {
  parseSocialAdsAccounts,
  type SocialAdsAccount,
} from './social-ads-account-parser';
import type { SocialAdsProvider } from './social-ads-reporting-card';

interface SocialAdsAccountControlsProps {
  displayName: string;
  merchantId?: string;
  needsAccountSelection: boolean;
  onSynced?: () => void;
  provider: SocialAdsProvider;
  syncWindow?: AdsSyncWindow;
}

const PROVIDER_PATH_SEGMENT: Record<SocialAdsProvider, string> = {
  meta_ads: 'meta',
  snapchat_ads: 'snapchat',
  tiktok_ads: 'tiktok',
};

async function responseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    return typeof payload.error === 'string' ? payload.error : fallback;
  } catch {
    return fallback;
  }
}

export function SocialAdsAccountControls({
  displayName,
  merchantId,
  needsAccountSelection,
  onSynced,
  provider,
  syncWindow,
}: SocialAdsAccountControlsProps) {
  const path = `/api/integrations/ads/${PROVIDER_PATH_SEGMENT[provider]}`;
  const [accounts, setAccounts] = useState<SocialAdsAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isChoosing, setIsChoosing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = async () => {
    setIsChoosing(true);
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${path}/accounts`, {
        credentials: 'include',
        headers: merchantId ? { 'x-baci-merchant-id': merchantId } : undefined,
      });
      if (!response.ok) {
        throw new Error(
          await responseError(
            response,
            `Unable to load ${displayName} accounts.`
          )
        );
      }
      const payload = (await response.json()) as { accounts?: unknown };
      const nextAccounts = parseSocialAdsAccounts(payload.accounts);
      setAccounts(nextAccounts);
      setSelectedId(
        nextAccounts.find((account) => account.selected)?.accountId ??
          nextAccounts[0]?.accountId ??
          null
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : `Unable to load ${displayName} accounts.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const sync = async () => {
    const requestedWindow = syncWindow ?? buildDefaultAdsSyncWindow();
    const windows = buildAdsSyncWindowChunks(requestedWindow, provider);
    for (const [index, window] of windows.entries()) {
      const response = await fetchWithCsrf(`${path}/sync`, {
        body: JSON.stringify({
          ...window,
          finalChunk: index === windows.length - 1,
        }),
        headers: merchantId ? { 'x-baci-merchant-id': merchantId } : undefined,
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(
          await responseError(response, `Unable to sync ${displayName}.`)
        );
      }
    }
  };

  const syncNow = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await sync();
      onSynced?.();
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : `Unable to sync ${displayName}.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveAccount = async () => {
    if (!selectedId) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetchWithCsrf(`${path}/accounts`, {
        body: JSON.stringify({ accountId: selectedId }),
        headers: merchantId ? { 'x-baci-merchant-id': merchantId } : undefined,
        method: 'PATCH',
      });
      if (!response.ok) {
        throw new Error(
          await responseError(
            response,
            `Unable to select ${displayName} account.`
          )
        );
      }
      try {
        await sync();
      } finally {
        onSynced?.();
      }
      setAccounts((current) =>
        current.map((account) => ({
          ...account,
          selected: account.accountId === selectedId,
        }))
      );
      setIsChoosing(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : `Unable to select ${displayName} account.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {!isChoosing && (
        <div className="flex flex-wrap gap-2">
          {!needsAccountSelection && (
            <Button
              disabled={isSaving}
              onClick={syncNow}
              size="sm"
              type="button"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCcw className="size-4" />
              )}
              Sync now
            </Button>
          )}
          <Button
            onClick={loadAccounts}
            size="sm"
            type="button"
            variant="outline"
          >
            <ListRestart className="size-4" />
            {needsAccountSelection ? 'Select account' : 'Change account'}
          </Button>
        </div>
      )}

      {isChoosing && isLoading && (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" />
          Loading {displayName} accounts…
        </div>
      )}

      {isChoosing && !isLoading && accounts.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">
          No accessible {displayName} accounts were found.
        </p>
      )}

      {isChoosing && !isLoading && accounts.length > 0 && (
        <div
          aria-label={`${displayName} accounts`}
          className="space-y-2"
          role="radiogroup"
        >
          {accounts.map((account) => (
            <label
              className="flex cursor-pointer items-center justify-between rounded-lg border p-2 text-sm"
              key={account.accountId}
            >
              <span>
                {account.label}
                {(account.currencyCode || account.timezoneName) && (
                  <span className="block text-xs text-muted-foreground">
                    {[account.currencyCode, account.timezoneName]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </span>
              <input
                checked={selectedId === account.accountId}
                name={`${provider}-account`}
                onChange={() => setSelectedId(account.accountId)}
                type="radio"
              />
            </label>
          ))}
          <Button
            disabled={isSaving || !selectedId}
            onClick={saveAccount}
            size="sm"
            type="button"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Save account and sync
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
