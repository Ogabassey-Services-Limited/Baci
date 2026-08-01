import { createHash } from 'node:crypto';
import { mapKnownGiglStatus } from '@baci/shared/lib';
import type { z } from 'zod';
import { GIGL_PICKUP_EN_ROUTE_RAW_STATUS } from '@/lib/shipping/gigl-tracking-notification-policy-matrix';
import type { TrackingEvent, TrackingResult } from '../types';
import {
  GIGL_TRACKING_MAX_FUTURE_SKEW_MS,
  PickupOptions,
} from './gigl.constants';
import type { giglSchemas } from './gigl.schemas';

type GiglTrackingShipment = z.input<typeof giglSchemas.trackingShipment>;

const timezoneSuffixPattern = /(?:Z|[+-]\d{2}:\d{2})$/i;
const bareIsoDateTimePattern =
  /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?$/;

function parseGiglTrackingTimestamp(value: string, isUtc: boolean): Date {
  const trimmed = value.trim();
  const normalized = trimmed.endsWith(' WAT')
    ? `${trimmed.slice(0, -4).replace(' ', 'T')}+01:00`
    : isUtc && bareIsoDateTimePattern.test(trimmed)
      ? `${trimmed.replace(' ', 'T')}Z`
      : trimmed;
  if (!timezoneSuffixPattern.test(normalized)) {
    throw new Error('GIGL tracking timestamp has no timezone');
  }
  const timestamp = new Date(normalized);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('GIGL tracking timestamp is invalid');
  }
  return timestamp;
}

function fallbackProviderEventKey(
  waybill: string,
  rawStatus: string,
  timestamp: Date
): string {
  const tuple = JSON.stringify([waybill, rawStatus, timestamp.toISOString()]);
  return `fallback:${createHash('sha256').update(tuple).digest('hex')}`;
}

export function normalizeGiglTrackingShipment(
  shipment: GiglTrackingShipment,
  requestedWaybill: string,
  observedAt: Date
): TrackingResult {
  if (Number.isNaN(observedAt.getTime())) {
    throw new Error('GIGL tracking observation timestamp is invalid');
  }

  const normalizedRequestedWaybill = requestedWaybill.trim();
  const responseWaybill = shipment.Waybill?.trim();
  if (responseWaybill && responseWaybill !== normalizedRequestedWaybill) {
    throw new Error('GIGL tracking waybill does not match requested waybill');
  }
  const waybill = responseWaybill || normalizedRequestedWaybill;
  const candidates = (shipment.MobileShipmentTrackings ?? []).flatMap(
    (event) => {
      try {
        const dateTimeUtc = event.DateTimeUtc?.trim();
        const timestampSource = dateTimeUtc || event.DateTime?.trim();
        if (!timestampSource) {
          throw new Error('GIGL tracking event has no timestamp');
        }
        const timestamp = parseGiglTrackingTimestamp(
          timestampSource,
          Boolean(dateTimeUtc)
        );
        if (
          timestamp.getTime() >
          observedAt.getTime() + GIGL_TRACKING_MAX_FUTURE_SKEW_MS
        ) {
          throw new Error(
            'GIGL tracking event timestamp is too far in the future'
          );
        }

        const rawStatus = event.Status.trim();
        const scanStatusReason = event.ScanStatusReason?.trim();
        const scanStatusIncident = event.ScanStatusIncident?.trim();
        const hasPickupEnRouteReason = [
          scanStatusReason,
          scanStatusIncident,
        ].some(
          (value) => value?.toUpperCase() === GIGL_PICKUP_EN_ROUTE_RAW_STATUS
        );
        const notificationRawStatus = hasPickupEnRouteReason
          ? GIGL_PICKUP_EN_ROUTE_RAW_STATUS
          : rawStatus;
        const recognizedStatus =
          mapKnownGiglStatus(rawStatus) ??
          (scanStatusReason ? mapKnownGiglStatus(scanStatusReason) : null) ??
          (scanStatusIncident ? mapKnownGiglStatus(scanStatusIncident) : null);
        const providerEventId =
          event.ShipmentTrackingId ?? event.MobileShipmentTrackingId;
        const providerEventKey =
          event.ShipmentTrackingId != null
            ? `shipment:${String(event.ShipmentTrackingId)}`
            : event.MobileShipmentTrackingId != null
              ? `mobile:${String(event.MobileShipmentTrackingId)}`
              : fallbackProviderEventKey(waybill, rawStatus, timestamp);

        return [
          {
            event: {
              description: scanStatusReason || scanStatusIncident || rawStatus,
              location:
                event.Location?.trim() ||
                event.DepartureServiceCentre?.Name?.trim() ||
                event.DepartureServiceCentre?.Address?.trim() ||
                undefined,
              providerEventId:
                providerEventId != null ? String(providerEventId) : undefined,
              providerEventKey,
              rawStatus: notificationRawStatus,
              status: recognizedStatus ?? 'pending',
              timestamp,
            } satisfies TrackingEvent,
            recognizedStatus,
          },
        ];
      } catch {
        return [];
      }
    }
  );

  const sortedCandidates = [...candidates].sort(
    (left, right) =>
      right.event.timestamp.getTime() - left.event.timestamp.getTime()
  );
  const newestRecognized = sortedCandidates.find(
    (candidate) => candidate.recognizedStatus !== null
  );
  if (sortedCandidates.length === 0) {
    throw new Error('GIGL tracking result has no valid tracking events');
  }
  const hasRecognizedLifecycleEvent = newestRecognized !== undefined;
  const status = newestRecognized?.recognizedStatus ?? 'pending';
  const deliveredEvent = sortedCandidates.find(
    (candidate) => candidate.recognizedStatus === 'delivered'
  );

  return {
    provider: 'GIGL',
    trackingNumber: waybill,
    status,
    carrierName: 'GIG Logistics',
    hasRecognizedLifecycleEvent,
    actualDelivery:
      status === 'delivered' ? deliveredEvent?.event.timestamp : undefined,
    events: sortedCandidates.map((candidate) => candidate.event),
    isStationPickup: shipment.PickupOptions === PickupOptions.ServiceCentre,
  };
}
