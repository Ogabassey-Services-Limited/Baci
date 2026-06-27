import { z } from 'zod';

const optionalStringSchema = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? undefined);

const optionalStringWithDefaultSchema = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? '');

const optionalNumberSchema = z
  .number()
  .finite()
  .nullable()
  .optional()
  .transform((value) => value ?? undefined);

const envelopeObject = z
  .object({
    status: optionalNumberSchema,
    message: optionalStringSchema,
    data: z.unknown().optional(),
  })
  .passthrough();

const loginData = z
  .object({
    'access-token': z.string().min(1),
    UserChannelCode: z.string().min(1),
    UserChannelType: optionalNumberSchema,
    CustomerType: optionalNumberSchema,
  })
  .passthrough();

const station = z
  .object({
    StationId: z.number().finite(),
    StationName: z.string().min(1),
    StationCode: optionalStringSchema,
    State: optionalStringSchema,
    StateName: optionalStringSchema,
    City: optionalStringSchema,
    Address: optionalStringSchema,
    Latitude: optionalNumberSchema,
    Longitude: optionalNumberSchema,
  })
  .passthrough();

const priceData = z
  .object({
    GrandTotal: z.number().finite(),
    MainCharge: optionalNumberSchema,
    DeliverPrice: optionalNumberSchema,
    PickupCharge: optionalNumberSchema,
    InsuranceValue: optionalNumberSchema,
    DeclaredValue: optionalNumberSchema,
    Discount: optionalNumberSchema,
    ShipmentItems: z.array(z.unknown()).optional(),
  })
  .passthrough();

const bookingData = z
  .object({
    Waybill: z.string().min(1),
  })
  .passthrough();

const trackingEvent = z
  .object({
    Status: z.string(),
    ScanStatusReason: optionalStringWithDefaultSchema,
    DateTime: z.string(),
    DepartureServiceCentre: z
      .object({
        Name: z.string(),
        Address: optionalStringSchema,
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const trackingShipment = z
  .object({
    Waybill: optionalStringSchema,
    Origin: optionalStringSchema,
    Destination: optionalStringSchema,
    PickupOptions: optionalNumberSchema,
    DeliveryType: optionalNumberSchema,
    MobileShipmentTrackings: z.array(trackingEvent).default([]),
  })
  .passthrough();

export const giglSchemas = {
  envelopeObject,
  loginData,
  station,
  stationsData: z.array(station),
  priceData,
  bookingData,
  trackingEvent,
  trackingShipment,
  trackingData: z.array(trackingShipment),
};

export type GiglStation = z.infer<typeof station>;
export type GiglEnvelopeObject = z.infer<typeof envelopeObject>;
