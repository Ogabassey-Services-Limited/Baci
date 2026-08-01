/**
 * Status Mapper
 * Normalizes shipment statuses from different providers to a unified format
 */

import { mapKnownGiglStatus } from '@baci/shared/lib';
import type { NormalizedShipmentStatus } from './types';

// =============================================================================
// GIGL STATUS MAPPING
// =============================================================================

export function mapGiglStatus(status: string): NormalizedShipmentStatus {
  return mapKnownGiglStatus(status) ?? 'pending';
}

// =============================================================================
// TOPSHIP STATUS MAPPING
// =============================================================================

const TOPSHIP_STATUS_MAP: Record<string, NormalizedShipmentStatus> = {
  // Draft / Pending
  Draft: 'pending',
  draft: 'pending',
  DRAFT: 'pending',

  // Confirmed / Booked
  Confirmed: 'booked',
  confirmed: 'booked',
  CONFIRMED: 'booked',

  // Pickup
  AwaitingPickUp: 'pickup_scheduled',
  awaitingpickup: 'pickup_scheduled',
  AWAITING_PICKUP: 'pickup_scheduled',
  PickupInProgress: 'pickup_scheduled',
  pickupinprogress: 'pickup_scheduled',
  PICKUP_IN_PROGRESS: 'pickup_scheduled',
  SuccessfullyPicked: 'picked_up',
  successfullypicked: 'picked_up',
  SUCCESSFULLY_PICKED: 'picked_up',

  // Transit
  InTransit: 'in_transit',
  intransit: 'in_transit',
  IN_TRANSIT: 'in_transit',

  // Out for Delivery
  DeliveryInProgress: 'out_for_delivery',
  deliveryinprogress: 'out_for_delivery',
  DELIVERY_IN_PROGRESS: 'out_for_delivery',
  OutForDelivery: 'out_for_delivery',

  // Delivered
  Delivered: 'delivered',
  delivered: 'delivered',
  DELIVERED: 'delivered',

  // Cancelled
  Cancelled: 'cancelled',
  cancelled: 'cancelled',
  CANCELLED: 'cancelled',

  // Failed
  DeliveryFailed: 'failed',
  deliveryfailed: 'failed',
  DELIVERY_FAILED: 'failed',
  Failed: 'failed',

  // Returned
  Returned: 'returned',
  returned: 'returned',
  RETURNED: 'returned',
};

export function mapTopshipStatus(status: string): NormalizedShipmentStatus {
  return (
    TOPSHIP_STATUS_MAP[status] ||
    TOPSHIP_STATUS_MAP[status.toLowerCase()] ||
    'pending'
  );
}

// =============================================================================
// GENERIC STATUS MAPPER
// =============================================================================

export function mapProviderStatus(
  provider: 'GIGL' | 'TOPSHIP',
  status: string
): NormalizedShipmentStatus {
  switch (provider) {
    case 'GIGL':
      return mapGiglStatus(status);
    case 'TOPSHIP':
      return mapTopshipStatus(status);
    default:
      return 'pending';
  }
}

// =============================================================================
// STATUS UTILITIES
// =============================================================================

/**
 * Check if a status is considered "active" (shipment is in progress)
 */
export function isActiveStatus(status: NormalizedShipmentStatus): boolean {
  return [
    'booked',
    'pickup_scheduled',
    'picked_up',
    'in_transit',
    'out_for_delivery',
  ].includes(status);
}

/**
 * Check if a status is considered "final" (no more updates expected)
 */
export function isFinalStatus(status: NormalizedShipmentStatus): boolean {
  return ['delivered', 'cancelled', 'failed', 'returned'].includes(status);
}

/**
 * Check if a status indicates successful delivery
 */
export function isDeliveredStatus(status: NormalizedShipmentStatus): boolean {
  return status === 'delivered';
}

/**
 * Check if a status indicates a problem
 */
export function isProblemStatus(status: NormalizedShipmentStatus): boolean {
  return ['cancelled', 'failed', 'returned'].includes(status);
}

/**
 * Get status progression order (for validation)
 */
export const STATUS_ORDER: NormalizedShipmentStatus[] = [
  'pending',
  'booked',
  'pickup_scheduled',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
];

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  from: NormalizedShipmentStatus,
  to: NormalizedShipmentStatus
): boolean {
  // Any status can transition to cancelled, failed, or returned
  if (['cancelled', 'failed', 'returned'].includes(to)) {
    return true;
  }

  // Final statuses cannot transition
  if (isFinalStatus(from)) {
    return false;
  }

  // Check order progression
  const fromIndex = STATUS_ORDER.indexOf(from);
  const toIndex = STATUS_ORDER.indexOf(to);

  // Can only move forward in the progression
  return toIndex > fromIndex;
}
