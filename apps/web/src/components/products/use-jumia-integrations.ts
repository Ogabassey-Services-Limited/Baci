'use client';

import { useEffect, useState } from 'react';

type ToastApi = (args: {
  title: string;
  description: string;
  variant?: 'default' | 'destructive';
}) => unknown;

interface JumiaIntegration {
  id: string;
  shop_name: string;
}

export function useJumiaIntegrations(
  merchantId: string | undefined,
  toast: ToastApi
) {
  const [jumiaIntegrations, setJumiaIntegrations] = useState<
    JumiaIntegration[]
  >([]);
  const [jumiaIntegrationId, setJumiaIntegrationId] = useState<string | null>(
    null
  );
  const [jumiaLoading, setJumiaLoading] = useState(false);

  useEffect(() => {
    if (!merchantId) return;

    setJumiaIntegrations([]);
    setJumiaIntegrationId(null);
    setJumiaLoading(true);
    const controller = new AbortController();

    fetch('/api/marketplace/jumia/connect', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(
            `Failed to fetch integrations: ${response.status} ${body}`
          );
        }

        return response.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;

        const integrations = Array.isArray(data.integrations)
          ? data.integrations.filter(
              (
                integration: unknown
              ): integration is JumiaIntegration & Record<string, unknown> =>
                typeof integration === 'object' &&
                integration !== null &&
                typeof (integration as Record<string, unknown>).id === 'string'
            )
          : [];

        setJumiaIntegrations(integrations);
        if (integrations.length === 1) {
          setJumiaIntegrationId(integrations[0].id);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        console.error('Failed to fetch Jumia integration:', error);
        toast({
          title: 'Jumia Integration',
          description:
            'Could not load Jumia integration. Export may be unavailable.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setJumiaLoading(false);
        }
      });

    return () => controller.abort();
  }, [merchantId, toast]);

  return {
    jumiaIntegrations,
    jumiaIntegrationId,
    setJumiaIntegrationId,
    jumiaLoading,
  };
}
