'use client';

import { AlertCircle, Check, ListRestart, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { fetchWithCsrf } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const ACCOUNTS_PATH = '/api/integrations/ads/google/accounts' as const;
const SYNC_PATH = '/api/integrations/ads/google/sync' as const;

interface GoogleAdsAccount {
  customerId: string;
  selected: boolean;
}

interface GoogleAdsAccountPickerProps {
  className?: string;
  onSynced?: () => void;
  syncWindow?: {
    endDate: string;
    startDate: string;
  };
}

function getDefaultSyncWindow(): { endDate: string; startDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 30);
  return {
    endDate: end.toISOString().slice(0, 10),
    startDate: start.toISOString().slice(0, 10),
  };
}

function maskCustomerId(customerId: string): string {
  const normalized = customerId.replaceAll('-', '');
  return `Google Ads account ••••${normalized.slice(-4)}`;
}

async function readError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    return typeof payload.error === 'string' ? payload.error : fallback;
  } catch {
    return fallback;
  }
}

export function GoogleAdsAccountPicker({
  className,
  onSynced,
  syncWindow,
}: GoogleAdsAccountPickerProps) {
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncComplete, setSyncComplete] = useState(false);

  const loadAccounts = async () => {
    setIsOpen(true);
    setIsLoadingAccounts(true);
    setError(null);
    setSyncComplete(false);

    try {
      const response = await fetch(ACCOUNTS_PATH, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(
          await readError(response, 'Unable to discover Google Ads accounts.')
        );
      }

      const payload = (await response.json()) as {
        accounts?: unknown;
      };
      const nextAccounts = Array.isArray(payload.accounts)
        ? payload.accounts.flatMap((account) => {
            if (typeof account !== 'object' || account === null) return [];
            const value = account as {
              customerId?: unknown;
              selected?: unknown;
            };
            return typeof value.customerId === 'string'
              ? [
                  {
                    customerId: value.customerId,
                    selected: value.selected === true,
                  },
                ]
              : [];
          })
        : [];
      setAccounts(nextAccounts);
      setSelectedCustomerId(
        nextAccounts.find((account) => account.selected)?.customerId ??
          nextAccounts[0]?.customerId ??
          null
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to discover Google Ads accounts.'
      );
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const selectAccount = async () => {
    if (!selectedCustomerId) return;

    setIsSaving(true);
    setError(null);
    try {
      const selectionResponse = await fetchWithCsrf(ACCOUNTS_PATH, {
        body: JSON.stringify({ customerId: selectedCustomerId }),
        method: 'PATCH',
      });
      if (!selectionResponse.ok) {
        throw new Error(
          await readError(
            selectionResponse,
            'Unable to select the Google Ads account.'
          )
        );
      }

      const response = await fetchWithCsrf(SYNC_PATH, {
        body: JSON.stringify(syncWindow ?? getDefaultSyncWindow()),
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(
          await readError(
            response,
            'Google Ads account selected, but sync failed.'
          )
        );
      }

      onSynced?.();
      setSyncComplete(true);
      setAccounts((currentAccounts) =>
        currentAccounts.map((account) => ({
          ...account,
          selected: account.customerId === selectedCustomerId,
        }))
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to select the Google Ads account.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {!isOpen && (
        <Button
          className="gap-2"
          onClick={loadAccounts}
          size="sm"
          type="button"
        >
          <ListRestart className="size-4" />
          Select Google Ads account
        </Button>
      )}

      {isOpen && isLoadingAccounts && (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" />
          Discovering Google Ads accounts…
        </div>
      )}

      {isOpen && !isLoadingAccounts && accounts.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">
          No accessible Google Ads accounts were found for this login.
        </p>
      )}

      {isOpen && !isLoadingAccounts && accounts.length > 0 && (
        <div
          aria-label="Google Ads accounts"
          className="space-y-2"
          role="radiogroup"
        >
          {accounts.map((account) => {
            const selected = account.customerId === selectedCustomerId;
            return (
              <label
                className={cn(
                  'flex min-h-11 w-full cursor-pointer items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors',
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-muted/50'
                )}
                key={account.customerId}
              >
                <input
                  checked={selected}
                  className="sr-only"
                  name="google-ads-account"
                  onChange={() => setSelectedCustomerId(account.customerId)}
                  type="radio"
                  value={account.customerId}
                />
                <span>{maskCustomerId(account.customerId)}</span>
                {selected && <Check className="size-4 text-primary" />}
              </label>
            );
          })}
          <Button
            className="gap-2"
            disabled={isSaving || selectedCustomerId === null}
            onClick={selectAccount}
            size="sm"
            type="button"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Save account and sync spend
          </Button>
        </div>
      )}

      {error && (
        <div className="space-y-2">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button
            onClick={loadAccounts}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry account discovery
          </Button>
        </div>
      )}

      {syncComplete && !error && (
        <p
          className="text-sm text-emerald-600 dark:text-emerald-400"
          role="status"
        >
          Google Ads account selected. Spend sync started.
        </p>
      )}
    </div>
  );
}
