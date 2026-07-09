import type { ShippingAddress, ShippingQuote } from '../types';
import type { GiglQuoteIo } from './gigl.constants';
import type { GiglServiceCentre, GiglStation } from './gigl.schemas';

const MAX_PICKUP_CENTRES = 3;
const EARTH_RADIUS_KM = 6371;

interface ServiceCentreQuoteParams {
  baseQuote: ShippingQuote;
  generateQuoteId: () => string;
  log?: GiglQuoteIo['log'];
  receiver: Pick<ShippingAddress, 'latitude' | 'longitude'>;
  receiverStation: GiglStation;
  fetchServiceCentres?: () => Promise<GiglServiceCentre[]>;
  serviceCentres?: GiglServiceCentre[];
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceKm(
  latitude: number,
  longitude: number,
  centre: GiglServiceCentre
): number {
  if (centre.Latitude === undefined || centre.Longitude === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  const latitudeDelta = toRadians(centre.Latitude - latitude);
  const longitudeDelta = toRadians(centre.Longitude - longitude);
  const startLatitude = toRadians(latitude);
  const endLatitude = toRadians(centre.Latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

function hasFiniteCoordinates(
  receiver: ServiceCentreQuoteParams['receiver']
): receiver is { latitude: number; longitude: number } {
  return (
    Number.isFinite(receiver.latitude) && Number.isFinite(receiver.longitude)
  );
}

function selectServiceCentres(
  serviceCentres: GiglServiceCentre[],
  receiver: ServiceCentreQuoteParams['receiver']
): GiglServiceCentre[] {
  const hasCoordinates = hasFiniteCoordinates(receiver);
  return [...serviceCentres]
    .sort((left, right) => {
      if (hasCoordinates) {
        const leftDistance = distanceKm(
          receiver.latitude,
          receiver.longitude,
          left
        );
        const rightDistance = distanceKm(
          receiver.latitude,
          receiver.longitude,
          right
        );
        const leftIsFinite = Number.isFinite(leftDistance);
        const rightIsFinite = Number.isFinite(rightDistance);
        if (leftIsFinite !== rightIsFinite) return leftIsFinite ? -1 : 1;
        if (leftIsFinite && rightIsFinite) {
          const distanceDifference = leftDistance - rightDistance;
          if (distanceDifference !== 0) return distanceDifference;
        }
      }
      return left.ServiceCentreName.localeCompare(right.ServiceCentreName);
    })
    .slice(0, MAX_PICKUP_CENTRES);
}

export async function expandGiglServiceCentreQuotes({
  baseQuote,
  fetchServiceCentres,
  generateQuoteId,
  log,
  receiver,
  receiverStation,
  serviceCentres,
}: ServiceCentreQuoteParams): Promise<ShippingQuote[]> {
  try {
    const availableCentres = serviceCentres ?? (await fetchServiceCentres?.());
    if (!availableCentres?.length) return [baseQuote];

    return selectServiceCentres(availableCentres, receiver).map((centre) => ({
      ...baseQuote,
      id: generateQuoteId(),
      displayName: `GIG Logistics - Pickup at ${centre.ServiceCentreName}`,
      providerRateId: baseQuote.providerRateId
        ? `${baseQuote.providerRateId}_${centre.ServiceCentreId}`
        : undefined,
      stationId: receiverStation.StationId,
      stationName: centre.ServiceCentreName,
      stationAddress: centre.Address,
      stationCode: centre.ServiceCentreCode ?? receiverStation.StationCode,
      pickupStationId: centre.ServiceCentreId,
      pickupStationName: centre.ServiceCentreName,
      pickupStationAddress: centre.Address,
      pickupStationCode:
        centre.ServiceCentreCode ?? receiverStation.StationCode,
      rawResponse: {
        baseRawResponse: baseQuote.rawResponse,
        receiverStation,
        serviceCentre: centre,
      },
    }));
  } catch (error) {
    log?.('warn', 'Failed to expand GIGL service centres', {
      error: String(error),
      stationId: receiverStation.StationId,
    });
    return [baseQuote];
  }
}
