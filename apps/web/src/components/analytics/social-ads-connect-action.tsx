'use client';

import { ExternalLink } from 'lucide-react';
import { type MouseEvent, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface SocialAdsConnectActionProps {
  displayName: string;
  href: string;
  navigateTo?: (href: string) => void;
  reconnect: boolean;
}

async function readConnectError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    return typeof payload.error === 'string' ? payload.error : fallback;
  } catch {
    return fallback;
  }
}

export function SocialAdsConnectAction({
  displayName,
  href,
  navigateTo,
  reconnect,
}: SocialAdsConnectActionProps) {
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (isConnecting) return;

    setConnectError(null);
    setIsConnecting(true);
    try {
      const response = await fetch(href, {
        credentials: 'include',
        redirect: 'manual',
      });
      const isRedirect =
        response.type === 'opaqueredirect' ||
        (response.status >= 300 && response.status < 400);
      if (!response.ok && !isRedirect) {
        throw new Error(
          await readConnectError(response, `Unable to connect ${displayName}.`)
        );
      }

      (navigateTo ?? ((target: string) => window.location.assign(target)))(
        response.headers.get('location') ?? href
      );
    } catch (error: unknown) {
      setConnectError(
        error instanceof Error
          ? error.message
          : `Unable to connect ${displayName}.`
      );
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <>
      {connectError && (
        <Alert variant="destructive">
          <AlertDescription>{connectError}</AlertDescription>
        </Alert>
      )}
      <Button asChild size="sm">
        <a aria-disabled={isConnecting} href={href} onClick={handleConnect}>
          {isConnecting
            ? `Connecting ${displayName}…`
            : `${reconnect ? 'Reconnect' : 'Connect'} ${displayName}`}
          <ExternalLink className="size-4" />
        </a>
      </Button>
    </>
  );
}
