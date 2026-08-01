import type { TrackingResult } from '../types';
import type { GiglApiClient } from './gigl.auth';
import {
  GIGL_TRACKING_RESPONSE_MAX_BYTES,
  GIGL_TRACKING_TIMEOUT_MS,
  type GiglProviderIo,
  isGiglAbortError,
} from './gigl.constants';
import { giglSchemas } from './gigl.schemas';
import { normalizeGiglTrackingShipment } from './gigl.tracking-normalizer';

export async function trackGiglShipment(
  apiClient: GiglApiClient,
  io: GiglProviderIo,
  trackingNumber: string
): Promise<TrackingResult> {
  const signal = AbortSignal.timeout(GIGL_TRACKING_TIMEOUT_MS);

  try {
    const tokenData = await apiClient.getApiToken(
      GIGL_TRACKING_TIMEOUT_MS,
      signal
    );
    const { envelope, response } =
      await apiClient.safeFetchEnvelopeWithAccessToken(
        `${apiClient.baseUrl}/track/mobileShipment?Waybill=${encodeURIComponent(trackingNumber)}&fetchOption=2`,
        tokenData,
        () => ({
          method: 'GET',
          timeout: GIGL_TRACKING_TIMEOUT_MS,
          signal,
        }),
        { maxResponseBytes: GIGL_TRACKING_RESPONSE_MAX_BYTES }
      );

    if (!response.ok) {
      io.log('error', 'GIGL tracking failed', { status: response.status });
      throw new Error('Failed to track GIGL shipment');
    }

    if (envelope?.status !== 200) {
      throw new Error('Invalid GIGL tracking response');
    }

    const trackingData = apiClient.parseEnvelopeData(
      envelope,
      giglSchemas.trackingData,
      'tracking'
    );

    if (trackingData.length === 0) {
      throw new Error('Shipment not found');
    }

    const shipment = trackingData[0];
    if (!shipment) {
      throw new Error('Shipment not found');
    }

    return normalizeGiglTrackingShipment(shipment, trackingNumber, new Date());
  } catch (error) {
    if (signal.aborted || isGiglAbortError(error)) {
      io.log('warn', 'GIGL tracking timed out', {
        timeoutMs: GIGL_TRACKING_TIMEOUT_MS,
      });
      throw new Error('GIGL tracking timed out');
    }

    throw error;
  }
}
