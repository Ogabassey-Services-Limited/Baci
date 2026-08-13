import type { RepairDeviceDetail } from '@baci/shared/repairs';
import { useEffect, useRef, useState } from 'react';
import {
  fetchRepairDeviceDetail,
  RepairCatalogUnavailableError,
} from '@/lib/repair-catalog-client';

export interface UseRepairDeviceDetailResult {
  detail: RepairDeviceDetail | null;
  isLoading: boolean;
  isNotFound: boolean;
  error: string | null;
}

/**
 * Fetches one device's catalogue detail (quotes + linked product) by slug.
 * Skips the request entirely for an empty slug (guards a bad/partial deep
 * link before it ever reaches the network).
 */
export function useRepairDeviceDetail(
  deviceSlug: string
): UseRepairDeviceDetailResult {
  const [detail, setDetail] = useState<RepairDeviceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(deviceSlug));
  const [isNotFound, setIsNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setDetail(null);
    setError(null);
    setIsNotFound(false);

    if (!deviceSlug) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    fetchRepairDeviceDetail(deviceSlug, controller.signal)
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        setDetail(result);
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return;
        if (err instanceof RepairCatalogUnavailableError) {
          setIsNotFound(true);
          setDetail(null);
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load device');
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [deviceSlug]);

  return { detail, isLoading, isNotFound, error };
}
