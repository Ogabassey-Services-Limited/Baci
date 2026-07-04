import type { OrderFulfillmentDetails } from '@baci/shared';
import type { ShipmentFulfillmentDetails } from './order-fulfillment-details';

export function normalizeFulfillmentIdentifier(
  field: 'imei' | 'serialNumber',
  value: string
): string {
  if (field === 'imei') {
    return value.replace(/\D/g, '').slice(0, 15);
  }

  return value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

export function buildOrderFulfillmentDetailsForPersistence(
  details: ShipmentFulfillmentDetails
): OrderFulfillmentDetails {
  const items = details.items.map((item) => ({
    id: item.id,
    imei: item.imei.trim() || null,
    orderItemId: item.orderItemId,
    productName: item.productName,
    serialNumber: item.serialNumber.trim() || null,
    unitCount: item.unitCount,
    unitIndex: item.unitIndex,
    variantName: item.variantName ?? null,
  }));
  const firstImeiItem = items.find((item) => item.imei);
  const firstSerialItem = items.find((item) => item.serialNumber);

  return {
    imei: (firstImeiItem?.imei ?? details.imei.trim()) || null,
    items: items.length > 0 ? items : undefined,
    serialNumber:
      (firstSerialItem?.serialNumber ?? details.serialNumber.trim()) || null,
  };
}
