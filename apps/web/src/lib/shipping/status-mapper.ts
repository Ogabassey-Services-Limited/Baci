/**
 * Status Mapper
 * Normalizes shipment statuses from different providers to a unified format
 */

import type { NormalizedShipmentStatus } from './types';

// =============================================================================
// GIGL STATUS MAPPING
// =============================================================================

const GIGL_STATUS_MAP: Record<string, NormalizedShipmentStatus> = {
  // Created / Booked
  SHIPMENT_CREATED: 'booked',
  Created: 'booked',
  CREATED: 'booked',
  Pending: 'pending',
  PENDING: 'pending',

  // Pickup
  ASSIGNED_FOR_PICKUP: 'pickup_scheduled',
  AssignedForPickup: 'pickup_scheduled',
  PICKUP_SCHEDULED: 'pickup_scheduled',
  PICKED_UP: 'picked_up',
  PickedUp: 'picked_up',
  Collected: 'picked_up',
  COLLECTED: 'picked_up',

  // Transit
  IN_TRANSIT: 'in_transit',
  SHIPMENT_IN_TRANSIT: 'in_transit',
  InTransit: 'in_transit',
  Processing: 'in_transit',
  PROCESSING: 'in_transit',
  Departed: 'in_transit',
  DEPARTED: 'in_transit',
  Arrived: 'in_transit',
  ARRIVED: 'in_transit',

  // Out for Delivery
  OUT_FOR_DELIVERY: 'out_for_delivery',
  OutForDelivery: 'out_for_delivery',
  OnDelivery: 'out_for_delivery',
  ON_DELIVERY: 'out_for_delivery',

  // Delivered
  DELIVERED: 'delivered',
  Delivered: 'delivered',
  SHIPMENT_DELIVERED: 'delivered',
  'Shipment delivered': 'delivered',
  COMPLETED: 'delivered',
  Completed: 'delivered',

  // Cancelled / Failed
  CANCELLED: 'cancelled',
  Cancelled: 'cancelled',
  CANCELED: 'cancelled',
  FAILED: 'failed',
  Failed: 'failed',
  DeliveryFailed: 'failed',
  DELIVERY_FAILED: 'failed',

  // Returned
  RETURNED: 'returned',
  Returned: 'returned',
  ReturnedToSender: 'returned',
  RETURNED_TO_SENDER: 'returned',
};

export function mapGiglStatus(status: string): NormalizedShipmentStatus {
  const normalized = status.trim();
  const screamingSnake = normalized.replace(/[\s-]+/g, '_').toUpperCase();
  return (
    GIGL_STATUS_MAP[normalized] || GIGL_STATUS_MAP[screamingSnake] || 'pending'
  );
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
