import { createPublicClient } from '@/lib/supabase/public';
import type { GiglServiceCentre, GiglStation } from './gigl.schemas';

interface NearestCentreRow {
  station_id: number;
  station_name: string;
  station_code: string | null;
  service_centre_id: number;
  service_centre_name: string;
  service_centre_code: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
}

export interface GiglDirectoryResult {
  stationId: number;
  serviceCentres: GiglServiceCentre[];
}

export interface GiglStationResolution {
  station: GiglStation;
  serviceCentres?: GiglServiceCentre[];
}

export type NearestGiglDirectoryLookup = (
  latitude: number,
  longitude: number,
  options?: { signal?: AbortSignal; timeout?: number }
) => Promise<GiglDirectoryResult | null>;

export interface GiglLocation {
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
}

export interface GiglResolutionOptions {
  preferNearest?: boolean;
  timeout?: number;
  signal?: AbortSignal;
}

export async function findNearestGiglServiceCentres(
  latitude: number,
  longitude: number,
  options?: { signal?: AbortSignal; timeout?: number }
): Promise<GiglDirectoryResult | null> {
  const supabase = createPublicClient({
    clientInfo: 'baci-gigl-service-centre-directory',
    timeoutMs: Math.min(options?.timeout ?? 1500, 1500),
  });
  const query = supabase.rpc('find_nearest_shipping_service_centres', {
    p_provider: 'GIGL',
    p_latitude: latitude,
    p_longitude: longitude,
    p_limit: 3,
  });
  const { data, error } = await (options?.signal
    ? query.abortSignal(options.signal)
    : query);
  if (error) throw error;
  const rows = (data ?? []) as NearestCentreRow[];
  if (rows.length === 0) return null;
  return {
    stationId: rows[0].station_id,
    serviceCentres: rows
      .filter((row) => row.station_id === rows[0].station_id)
      .map((row) => ({
        StationId: row.station_id,
        StationName: row.station_name,
        StationCode: row.station_code ?? undefined,
        ServiceCentreId: row.service_centre_id,
        ServiceCentreName: row.service_centre_name,
        ServiceCentreCode: row.service_centre_code ?? undefined,
        Address: row.address ?? undefined,
        Latitude: row.latitude,
        Longitude: row.longitude,
      })),
  };
}
