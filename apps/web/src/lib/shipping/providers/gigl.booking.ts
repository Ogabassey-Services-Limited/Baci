import type { BookingRequest, ShipmentBookingResult } from '../types';
import type { GiglApiClient } from './gigl.auth';
import {
  type GiglProviderIo,
  getVehicleTypeForWeight,
  PickupOptions,
  parseGiglProviderRateId,
  ShipmentType,
} from './gigl.constants';
import { giglSchemas } from './gigl.schemas';
import type { GiglStationsService } from './gigl.stations';

export async function bookGiglShipment(
  apiClient: GiglApiClient,
  stationsService: GiglStationsService,
  io: GiglProviderIo,
  request: BookingRequest
): Promise<ShipmentBookingResult> {
  const tokenData = await apiClient.getApiToken();
  const selectedRate = parseGiglProviderRateId(request.providerRateId);
  const isStationPickup =
    selectedRate.pickupOption === PickupOptions.ServiceCentre;
  const totalWeight = request.items.reduce(
    (sum, item) => sum + item.weight * item.quantity,
    0
  );
  const vehicleType =
    selectedRate.vehicleType ?? getVehicleTypeForWeight(totalWeight);
  const senderStation = await stationsService.findStationForCity(
    request.sender.city,
    request.sender.state
  );

  if (!senderStation) {
    throw new Error('No GIGL station found for pickup location');
  }

  if (isStationPickup && selectedRate.receiverStationId === undefined) {
    throw new Error('Invalid GIGL station pickup rate');
  }

  const selectedReceiverStation =
    selectedRate.receiverStationId !== undefined
      ? await stationsService.findStationById(selectedRate.receiverStationId)
      : null;

  if (
    selectedRate.receiverStationId !== undefined &&
    !selectedReceiverStation
  ) {
    throw new Error('Selected GIGL station was not found');
  }

  const receiverStation =
    selectedReceiverStation ||
    (await stationsService.findStationForCity(
      request.receiver.city,
      request.receiver.state
    ));

  if (!receiverStation) {
    throw new Error('No GIGL station found for delivery location');
  }

  const bookingTokenData = apiClient.currentToken ?? tokenData;
  const { envelope, response } =
    await apiClient.safeFetchEnvelopeWithAccessToken(
      `${apiClient.baseUrl}/capture/preshipment`,
      bookingTokenData,
      () => ({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          SenderDetails: {
            SenderLocation: {
              Latitude:
                request.sender.latitude ?? senderStation.Latitude ?? 6.5244,
              Longitude:
                request.sender.longitude ?? senderStation.Longitude ?? 3.3792,
            },
            SenderName: request.sender.name,
            SenderPhoneNumber: request.sender.phone,
            SenderStationId: senderStation.StationId,
            SenderAddress: request.sender.address,
            InputtedSenderAddress: request.sender.address,
            SenderLocality: request.sender.state,
          },
          ReceiverDetails: {
            ReceiverLocation: {
              Latitude:
                request.receiver.latitude ?? receiverStation.Latitude ?? 6.5244,
              Longitude:
                request.receiver.longitude ??
                receiverStation.Longitude ??
                3.3792,
            },
            ReceiverStationId: receiverStation.StationId,
            ReceiverName: request.receiver.name,
            ReceiverPhoneNumber: request.receiver.phone,
            ReceiverAddress: request.receiver.address,
            InputtedReceiverAddress: request.receiver.address,
          },
          ShipmentDetails: {
            VehicleType: vehicleType,
            PickUpOptions: selectedRate.pickupOption,
            DeliveryOptionIds: isStationPickup ? [11] : [2],
            IsFromAgility: 0,
            IsBatchPickUp: 0,
          },
          ShipmentItems: request.items.map((item) => ({
            ItemName: item.name,
            Description: item.description || item.name,
            Quantity: item.quantity,
            Value: item.value,
            ShipmentType: ShipmentType.Regular,
            Weight: item.weight,
            IsVolumetric: false,
          })),
        }),
      })
    );

  if (!response.ok) {
    const error = await response.text();
    io.log('error', 'GIGL booking failed', {
      status: response.status,
      error,
    });
    throw new Error('Failed to book GIGL shipment');
  }

  if (envelope?.status !== 200) {
    throw new Error('Invalid GIGL booking response');
  }

  const bookingData = apiClient.parseEnvelopeData(
    envelope,
    giglSchemas.bookingData,
    'booking'
  );
  const waybill = bookingData.Waybill;

  return {
    provider: 'GIGL',
    providerShipmentId: waybill,
    trackingNumber: waybill,
    carrierName: 'GIG Logistics',
    status: 'booked',
    isStationPickup,
    pickupStationName: isStationPickup
      ? receiverStation.StationName
      : undefined,
    pickupStationAddress: isStationPickup ? receiverStation.Address : undefined,
    rawResponse: bookingData,
  };
}
