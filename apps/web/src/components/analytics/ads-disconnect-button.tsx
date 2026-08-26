'use client';

import { Loader2, Unplug } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { fetchWithCsrf } from '@/lib/api-client';

type AdsProvider = 'google' | 'meta' | 'snapchat' | 'tiktok';

interface AdsDisconnectButtonProps {
  displayName: string;
  merchantId?: string;
  onDisconnected?: () => void;
  provider: AdsProvider;
}

async function readDisconnectError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    return typeof payload.error === 'string' ? payload.error : fallback;
  } catch {
    return fallback;
  }
}

export function AdsDisconnectButton({
  displayName,
  merchantId,
  onDisconnected,
  provider,
}: AdsDisconnectButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const disconnect = async () => {
    setError(null);
    setIsDisconnecting(true);
    try {
      const response = await fetchWithCsrf(
        `/api/integrations/ads/${provider}/disconnect`,
        {
          headers: merchantId
            ? { 'x-baci-merchant-id': merchantId }
            : undefined,
          method: 'DELETE',
        }
      );
      if (!response.ok) {
        throw new Error(
          await readDisconnectError(
            response,
            `Unable to disconnect ${displayName}.`
          )
        );
      }
      onDisconnected?.();
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : `Unable to disconnect ${displayName}.`
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        disabled={isDisconnecting}
        onClick={disconnect}
        size="sm"
        type="button"
        variant="outline"
      >
        {isDisconnecting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Unplug className="size-4" />
        )}
        {isDisconnecting
          ? `Disconnecting ${displayName}…`
          : `Disconnect ${displayName}`}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
