import type { BookingRequest, ShipmentBookingResult } from '../types';
import type { GiglApiClient } from './gigl.auth';
import {
  GIGL_BOOKING_TIMEOUT_MS,
  type GiglProviderIo,
  type GiglToken,
  isGiglAbortError,
} from './gigl.constants';
import {
  buildInternationalItems,
  buildInternationalPackages,
  firstString,
  GIGL_INTERNATIONAL_PROVIDER_RATE_PREFIX,
  generateInternationalInvoiceLabel,
  parseInternationalRateId,
  resolveDestinationCountryId,
  totalDeclaredValue,
} from './gigl.international-payload';
import { giglSchemas } from './gigl.schemas';

export function isGiglInternationalBookingRequest(
  request: BookingRequest
): boolean {
  return (
    request.providerRateId?.startsWith(
      `${GIGL_INTERNATIONAL_PROVIDER_RATE_PREFIX}_`
    ) === true
  );
}

export async function bookGiglInternationalShipment(
  apiClient: GiglApiClient,
  io: GiglProviderIo,
  request: BookingRequest
): Promise<ShipmentBookingResult> {
  const signal = AbortSignal.timeout(GIGL_BOOKING_TIMEOUT_MS);
  const selectedRate = parseInternationalRateId(request.providerRateId);
  let bookingTokenData!: GiglToken;
  let bookingData!: ReturnType<
    typeof giglSchemas.internationalBookingData.parse
  >;
  let trackingNumber!: string;

  try {
    const tokenData = await apiClient.getApiToken(
      GIGL_BOOKING_TIMEOUT_MS,
      signal
    );
    const declaredValue = totalDeclaredValue(request);
    const destinationCountryId = await resolveDestinationCountryId(
      apiClient,
      tokenData,
      request,
      GIGL_BOOKING_TIMEOUT_MS,
      signal
    );
    if (destinationCountryId === undefined) {
      throw new Error('GIGL international destination country not found');
    }
    const shipmentPackages = buildInternationalPackages(request.items);
    const {
      envelope,
      response,
      tokenData: refreshedTokenData,
    } = await apiClient.safeFetchEnvelopeWithAccessToken(
      `${apiClient.baseUrl}/intlShipment/create`,
      tokenData,
      () => ({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Shipments: [
            {
              Receiver: {
                ReceiverName: request.receiver.name,
                ReceiverPhoneNumber: request.receiver.phone,
                ReceiverAltPhoneNumber: request.receiver.phone,
                ReceiverEmail: request.receiver.email,
                ReceiverCity: request.receiver.city,
                ReceiverAddress: request.receiver.address,
                ReceiverState: request.receiver.state,
                ReceiverPostalCode: request.receiver.postalCode,
                ReceiverCountryCode: request.receiver.countryCode,
                ReceiverCountry: request.receiver.country,
                ReceiverStateOrProvinceCode: request.receiver.state,
              },
              ShipmentItems: buildInternationalItems(request.items),
              ShipmentDetails: {
                DestinationCountryId: destinationCountryId,
                Description:
                  request.specialInstructions ||
                  request.instructions ||
                  request.items.map((item) => item.name).join(', '),
                ManufacturerCountry: request.sender.country || 'Nigeria',
                PickupOptions: selectedRate.pickupOption,
                DeclaredValue: declaredValue,
                DeliveryType: selectedRate.deliveryType,
                IsVacuumSeal: false,
                IsPhytosanitaryCertification: false,
                // ShipmentMethod is part of the quote rate ID, but the current
                // /intlShipment/create schema does not accept it.
                LogisticsCompany: selectedRate.logisticsCompany,
              },
              ...(shipmentPackages.length > 0
                ? { ShipmentPackages: shipmentPackages }
                : {}),
            },
          ],
        }),
        timeout: GIGL_BOOKING_TIMEOUT_MS,
        signal,
      })
    );
    bookingTokenData = refreshedTokenData;

    if (!response.ok) {
      const error = await response.text();
      io.log('error', 'GIGL international booking failed', {
        status: response.status,
        error,
      });
      throw new Error('Failed to book GIGL international shipment');
    }

    if (envelope?.status !== 200) {
      throw new Error('Invalid GIGL international booking response');
    }

    try {
      bookingData = apiClient.parseEnvelopeData(
        envelope,
        giglSchemas.internationalBookingData,
        'international booking'
      );
    } catch (parseError) {
      io.log('error', 'Failed to parse GIGL international booking response', {
        error: String(parseError),
      });
      throw new Error(
        'GIGL international booking response missing tracking number'
      );
    }
    trackingNumber =
      firstString(
        bookingData.Waybill,
        bookingData.WaybillNumber,
        bookingData.waybill,
        bookingData.RequestNumber,
        bookingData.requestNumber
      ) ?? '';
  } catch (error) {
    if (signal.aborted || isGiglAbortError(error)) {
      io.log('warn', 'GIGL international booking timed out', {
        timeoutMs: GIGL_BOOKING_TIMEOUT_MS,
      });
      throw new Error('GIGL international booking timed out');
    }

    throw error;
  }

  let labelUrl: string | undefined;
  try {
    const labelSignal = AbortSignal.timeout(GIGL_BOOKING_TIMEOUT_MS);
    labelUrl = await generateInternationalInvoiceLabel(
      apiClient,
      bookingTokenData,
      trackingNumber,
      io,
      labelSignal
    );
  } catch (error) {
    io.log('warn', 'Failed to generate GIGL international invoice label', {
      trackingNumber,
      error: String(error),
    });
  }

  return {
    provider: 'GIGL',
    providerShipmentId: trackingNumber,
    trackingNumber,
    labelUrl,
    carrierName: 'GIG Logistics',
    status: 'booked',
    rawResponse: bookingData,
  };
}
