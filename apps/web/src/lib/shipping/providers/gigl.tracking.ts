import { mapGiglStatus } from '../status-mapper';
import type { TrackingEvent, TrackingResult } from '../types';
import type { GiglApiClient } from './gigl.auth';
import {
  GIGL_TRACKING_TIMEOUT_MS,
  type GiglProviderIo,
  isGiglAbortError,
  PickupOptions,
} from './gigl.constants';
import { giglSchemas } from './gigl.schemas';

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
        `${apiClient.baseUrl}/track/mobileShipment?Waybill=${encodeURIComponent(trackingNumber)}`,
        tokenData,
        () => ({
          method: 'GET',
          timeout: GIGL_TRACKING_TIMEOUT_MS,
          signal,
        })
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
    const events: TrackingEvent[] = (
      shipment.MobileShipmentTrackings || []
    ).map((tracking) => ({
      status: mapGiglStatus(tracking.Status),
      description: tracking.ScanStatusReason || tracking.Status,
      location: tracking.DepartureServiceCentre?.Name,
      timestamp: new Date(tracking.DateTime),
      rawStatus: tracking.Status,
    }));
    const sortedEvents = [...events].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    const latestEvent = sortedEvents[0];
    const status = latestEvent
      ? mapGiglStatus(latestEvent.rawStatus || '')
      : 'pending';
    const actualDelivery =
      status === 'delivered' && latestEvent ? latestEvent.timestamp : undefined;

    return {
      provider: 'GIGL',
      trackingNumber,
      status,
      carrierName: 'GIG Logistics',
      actualDelivery,
      events: sortedEvents,
      isStationPickup: shipment.PickupOptions === PickupOptions.ServiceCentre,
    };
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
