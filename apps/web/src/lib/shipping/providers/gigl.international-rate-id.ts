import { PickupOptions } from './gigl.constants';

export const GIGL_INTERNATIONAL_PROVIDER_RATE_PREFIX = 'GIGL_INTL';

export interface InternationalRateSelection {
  deliveryType: number;
  logisticsCompany: number;
  shipmentMethod: number;
  pickupOption: PickupOptions;
}

export function isGiglInternationalProviderRate(
  provider: string | null | undefined,
  providerRateId: string | null | undefined
): boolean {
  if (
    provider !== 'GIGL' ||
    providerRateId?.startsWith(
      `${GIGL_INTERNATIONAL_PROVIDER_RATE_PREFIX}_`
    ) !== true
  ) {
    return false;
  }

  try {
    parseInternationalRateId(providerRateId);
    return true;
  } catch {
    return false;
  }
}

export function internationalRateId(
  selection: InternationalRateSelection
): string {
  return [
    GIGL_INTERNATIONAL_PROVIDER_RATE_PREFIX,
    selection.deliveryType,
    selection.logisticsCompany,
    selection.shipmentMethod,
    selection.pickupOption,
  ].join('_');
}

export function parseInternationalRateId(
  providerRateId?: string
): InternationalRateSelection {
  const prefix = `${GIGL_INTERNATIONAL_PROVIDER_RATE_PREFIX}_`;
  if (!providerRateId?.startsWith(prefix)) {
    throw new Error('Invalid GIGL international rate selection');
  }

  const segments = providerRateId.slice(prefix.length).split('_');
  if (segments.length !== 4 || segments.some((segment) => !segment)) {
    throw new Error('Invalid GIGL international rate selection');
  }
  const [deliveryType, logisticsCompany, shipmentMethod, pickupOption] =
    segments;
  const parsedPickupOption = Number(pickupOption);
  if (
    parsedPickupOption !== PickupOptions.HomeDelivery &&
    parsedPickupOption !== PickupOptions.ServiceCentre
  ) {
    throw new Error('Invalid GIGL international rate selection');
  }

  return {
    deliveryType: readRateIdNumber(deliveryType),
    logisticsCompany: readRateIdNumber(logisticsCompany),
    shipmentMethod: readRateIdNumber(shipmentMethod),
    pickupOption: parsedPickupOption,
  };
}

function readRateIdNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('Invalid GIGL international rate selection');
  }
  return parsed;
}
