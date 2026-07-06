import type { QuoteRequest, ShippingQuote } from '../types';
import type { GiglApiClient } from './gigl.auth';
import {
  GIGL_QUOTE_TIMEOUT_MS,
  type GiglQuoteIo,
  isGiglAbortError,
  PickupOptions,
} from './gigl.constants';
import {
  buildInternationalItems,
  buildInternationalPackages,
  estimatedDays,
  internationalRateId,
  internationalServiceTier,
  isNigeriaAddress,
  resolveDestinationCountryId,
  totalDeclaredValue,
} from './gigl.international-payload';
import { giglSchemas } from './gigl.schemas';

export async function getGiglInternationalQuotes(
  apiClient: GiglApiClient,
  io: GiglQuoteIo,
  request: QuoteRequest
): Promise<ShippingQuote[]> {
  if (
    request.shipmentType !== 'international' ||
    !request.sender ||
    !isNigeriaAddress(request.sender) ||
    isNigeriaAddress(request.receiver)
  ) {
    return [];
  }

  const signal = AbortSignal.timeout(GIGL_QUOTE_TIMEOUT_MS);

  try {
    const tokenData = await apiClient.getApiToken(
      GIGL_QUOTE_TIMEOUT_MS,
      signal
    );
    const declaredValue = totalDeclaredValue(request);
    const pickupOption = PickupOptions.ServiceCentre;
    const destinationCountryId = await resolveDestinationCountryId(
      apiClient,
      tokenData,
      request,
      GIGL_QUOTE_TIMEOUT_MS,
      signal
    );
    if (destinationCountryId === undefined) {
      io.log('warn', 'GIGL international destination country not found', {
        country: request.receiver.country,
        countryCode: request.receiver.countryCode,
      });
      return [];
    }
    const shipmentPackages = buildInternationalPackages(request.items);
    const { envelope, response } =
      await apiClient.safeFetchEnvelopeWithAccessToken(
        `${apiClient.baseUrl}/intlShipment/price`,
        tokenData,
        () => ({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            DestinationCountryId: destinationCountryId,
            ReceiverCity: request.receiver.city,
            ReceiverAddress: request.receiver.address,
            ReceiverPostalCode: request.receiver.postalCode,
            ReceiverCountryCode: request.receiver.countryCode,
            ReceiverCountry: request.receiver.country,
            ReceiverStateOrProvinceCode: request.receiver.state,
            PickupOptions: pickupOption,
            DeclaredValue: declaredValue,
            IsVacuumSeal: false,
            IsPhytosanitaryCertification: false,
            ShipmentItems: buildInternationalItems(request.items),
            ...(shipmentPackages.length > 0
              ? { ShipmentPackages: shipmentPackages }
              : {}),
          }),
          timeout: GIGL_QUOTE_TIMEOUT_MS,
          signal,
        })
      );

    if (!response.ok || envelope?.status !== 200) {
      io.log('warn', 'GIGL international quote failed', {
        status: response.status,
        envelopeStatus: envelope?.status,
      });
      return [];
    }

    const rates = apiClient.parseEnvelopeData(
      envelope,
      giglSchemas.internationalPriceData,
      'international price'
    );

    return rates.flatMap((rate) => {
      if (!hasInternationalBookingSelectors(rate)) {
        io.log('warn', 'Skipping GIGL international rate without selectors', {
          deliveryType: rate.DeliveryType,
          grandTotal: rate.GrandTotal,
          logisticCompany: rate.LogisticCompany,
          shipmentMethod: rate.ShipmentMethod,
        });
        return [];
      }

      const deliveryType = rate.DeliveryType;
      const logisticsCompany = rate.LogisticCompany;
      const shipmentMethod = rate.ShipmentMethod;
      const serviceTier = internationalServiceTier(deliveryType);

      return [
        {
          id: io.generateQuoteId(),
          provider: 'GIGL',
          serviceTier,
          carrierName: 'GIG Logistics',
          displayName: `GIG Logistics - ${serviceTier}`,
          estimatedDays: estimatedDays(rate.EstimatedDeliveryDateAndTime),
          price: Math.round(rate.GrandTotal),
          currency: 'NGN',
          pickupIncluded: true,
          insuranceIncluded: true,
          providerRateId: internationalRateId({
            deliveryType,
            logisticsCompany,
            shipmentMethod,
            pickupOption,
          }),
          expiresAt: io.getQuoteExpiry(1),
          rawResponse: rate,
        },
      ];
    });
  } catch (error) {
    if (signal.aborted || isGiglAbortError(error)) {
      io.log('warn', 'GIGL international quote timed out', {
        timeoutMs: GIGL_QUOTE_TIMEOUT_MS,
      });
      return [];
    }

    io.log('error', 'Failed to get GIGL international quotes', {
      error: String(error),
    });
    return [];
  }
}

function hasInternationalBookingSelectors(rate: {
  DeliveryType?: number;
  LogisticCompany?: number;
  ShipmentMethod?: number;
}): rate is {
  DeliveryType: number;
  LogisticCompany: number;
  ShipmentMethod: number;
} {
  return (
    Number.isFinite(rate.DeliveryType) &&
    Number.isFinite(rate.LogisticCompany) &&
    Number.isFinite(rate.ShipmentMethod)
  );
}
