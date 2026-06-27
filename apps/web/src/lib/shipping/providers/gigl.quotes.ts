import type { QuoteRequest, ShippingQuote } from '../types';
import type { GiglApiClient } from './gigl.auth';
import {
  GIGL_QUOTE_TIMEOUT_MS,
  type GiglQuoteIo,
  type GiglToken,
  getVehicleTypeForWeight,
  isGiglAbortError,
  PickupOptions,
  ShipmentType,
} from './gigl.constants';
import type { GiglStation } from './gigl.schemas';
import { giglSchemas } from './gigl.schemas';
import type { GiglStationsService } from './gigl.stations';

export function getGiglQuotes(
  apiClient: GiglApiClient,
  stationsService: GiglStationsService,
  io: GiglQuoteIo,
  request: QuoteRequest
): Promise<ShippingQuote[]> {
  const signal = AbortSignal.timeout(GIGL_QUOTE_TIMEOUT_MS);
  return getQuotesWithinTimeout(
    apiClient,
    stationsService,
    io,
    request,
    signal
  );
}

async function getQuotesWithinTimeout(
  apiClient: GiglApiClient,
  stationsService: GiglStationsService,
  io: GiglQuoteIo,
  request: QuoteRequest,
  signal: AbortSignal
): Promise<ShippingQuote[]> {
  try {
    const tokenData = await apiClient.getApiToken(
      GIGL_QUOTE_TIMEOUT_MS,
      signal
    );
    const senderStation = request.sender
      ? await stationsService.findStationForCity(
          request.sender.city,
          request.sender.state,
          GIGL_QUOTE_TIMEOUT_MS,
          signal
        )
      : null;
    const receiverStation = await stationsService.findStationForCity(
      request.receiver.city,
      request.receiver.state,
      GIGL_QUOTE_TIMEOUT_MS,
      signal
    );

    if (!receiverStation) {
      io.log('warn', 'No GIGL station found for receiver location', {
        city: request.receiver.city,
        state: request.receiver.state,
      });
      return [];
    }

    const totalWeight = request.items.reduce(
      (sum, item) => sum + item.weight * item.quantity,
      0
    );
    const totalValue = request.items.reduce(
      (sum, item) => sum + item.value * item.quantity,
      0
    );
    const homeDeliveryQuote = await fetchGiglQuote(
      apiClient,
      io,
      tokenData,
      request,
      senderStation,
      receiverStation,
      PickupOptions.HomeDelivery,
      totalWeight,
      totalValue,
      signal
    );

    if (homeDeliveryQuote) {
      return [homeDeliveryQuote];
    }

    const stationPickupQuote = await fetchGiglQuote(
      apiClient,
      io,
      tokenData,
      request,
      senderStation,
      receiverStation,
      PickupOptions.ServiceCentre,
      totalWeight,
      totalValue,
      signal
    );

    return stationPickupQuote ? [stationPickupQuote] : [];
  } catch (error) {
    if (signal.aborted || isGiglAbortError(error)) {
      io.log('warn', 'GIGL quote timed out', {
        timeoutMs: GIGL_QUOTE_TIMEOUT_MS,
      });
      return [];
    }

    io.log('error', 'Failed to get GIGL quotes', { error: String(error) });
    return [];
  }
}

async function fetchGiglQuote(
  apiClient: GiglApiClient,
  io: GiglQuoteIo,
  tokenData: GiglToken,
  request: QuoteRequest,
  senderStation: GiglStation | null,
  receiverStation: GiglStation,
  pickupOption: PickupOptions,
  totalWeight: number,
  totalValue: number,
  signal: AbortSignal
): Promise<ShippingQuote | null> {
  try {
    const activeTokenData = apiClient.currentToken ?? tokenData;
    const { envelope, response } =
      await apiClient.safeFetchEnvelopeWithAccessToken(
        `${apiClient.baseUrl}/price`,
        activeTokenData,
        (currentTokenData) => ({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            SenderStationId: senderStation?.StationId ?? 4,
            ReceiverStationId: receiverStation.StationId,
            SenderLocation: senderStation
              ? {
                  Latitude: senderStation.Latitude ?? 6.5244,
                  Longitude: senderStation.Longitude ?? 3.3792,
                }
              : { Latitude: 6.5244, Longitude: 3.3792 },
            ReceiverLocation: {
              Latitude:
                request.receiver.latitude ?? receiverStation.Latitude ?? 6.5244,
              Longitude:
                request.receiver.longitude ??
                receiverStation.Longitude ??
                3.3792,
            },
            VehicleType: getVehicleTypeForWeight(totalWeight),
            PickUpOptions: pickupOption,
            DeliveryOptionIds:
              pickupOption === PickupOptions.HomeDelivery ? [2] : [11],
            IsFromAgility: false,
            CustomerCode: currentTokenData.userChannelCode,
            CustomerType: currentTokenData.customerType,
            Value: totalValue,
            ShipmentItems: request.items.map((item) => ({
              ItemName: item.name,
              Description: item.description || item.name,
              Quantity: item.quantity,
              Weight: item.weight,
              Value: item.value,
              IsVolumetric: false,
              ShipmentType: ShipmentType.Regular,
            })),
          }),
          timeout: GIGL_QUOTE_TIMEOUT_MS,
          signal,
        })
      );

    if (!response.ok) {
      const error = await response.text();
      io.log('warn', 'GIGL quote request failed', {
        status: response.status,
        error,
      });
      return null;
    }

    if (envelope?.status !== 200) {
      return null;
    }

    const priceData = apiClient.parseEnvelopeData(
      envelope,
      giglSchemas.priceData,
      'price'
    );
    const isStationPickup = pickupOption === PickupOptions.ServiceCentre;

    return {
      id: io.generateQuoteId(),
      provider: 'GIGL',
      serviceTier: isStationPickup ? 'Station Pickup' : 'Standard',
      carrierName: 'GIG Logistics',
      displayName: isStationPickup
        ? 'GIG Logistics - Station Pickup'
        : 'GIG Logistics - Home Delivery',
      estimatedDays: 3,
      minDays: 2,
      maxDays: 5,
      price: Math.round(priceData.GrandTotal),
      currency: 'NGN',
      pickupIncluded: true,
      insuranceIncluded: true,
      providerRateId: `GIGL_${receiverStation.StationId}_${pickupOption}_${getVehicleTypeForWeight(totalWeight)}`,
      expiresAt: io.getQuoteExpiry(1),
      stationId: isStationPickup ? receiverStation.StationId : undefined,
      stationName: isStationPickup ? receiverStation.StationName : undefined,
      stationAddress: isStationPickup ? receiverStation.Address : undefined,
      isStationPickup,
      pickupStationId: isStationPickup ? receiverStation.StationId : undefined,
      pickupStationName: isStationPickup
        ? receiverStation.StationName
        : undefined,
      pickupStationAddress: isStationPickup
        ? receiverStation.Address
        : undefined,
      rawResponse: priceData,
    };
  } catch (error) {
    if (signal.aborted || isGiglAbortError(error)) {
      throw error;
    }

    io.log('error', 'Error fetching GIGL quote', { error: String(error) });
    return null;
  }
}
