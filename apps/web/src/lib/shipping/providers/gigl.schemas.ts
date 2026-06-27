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
  .nullable()
  .optional()
  .transform((value) => value ?? undefined);

const envelopeObject = z.looseObject({
  status: optionalNumberSchema,
  message: optionalStringSchema,
  data: z.unknown().optional(),
});

const loginData = z.looseObject({
  'access-token': z.string().min(1),
  UserChannelCode: z.string().min(1),
  UserChannelType: optionalNumberSchema,
  CustomerType: optionalNumberSchema,
});

const station = z.looseObject({
  StationId: z.number(),
  StationName: z.string().min(1),
  StationCode: optionalStringSchema,
  State: optionalStringSchema,
  StateName: optionalStringSchema,
  City: optionalStringSchema,
  Address: optionalStringSchema,
  Latitude: optionalNumberSchema,
  Longitude: optionalNumberSchema,
});

const priceData = z.looseObject({
  GrandTotal: z.number(),
  MainCharge: optionalNumberSchema,
  DeliverPrice: optionalNumberSchema,
  PickupCharge: optionalNumberSchema,
  InsuranceValue: optionalNumberSchema,
  DeclaredValue: optionalNumberSchema,
  Discount: optionalNumberSchema,
  ShipmentItems: z.array(z.unknown()).optional(),
});

const bookingData = z.looseObject({
  Waybill: z.string().min(1),
});

const trackingEvent = z.looseObject({
  Status: z.string(),
  ScanStatusReason: optionalStringWithDefaultSchema,
  DateTime: z.string(),
  DepartureServiceCentre: z
    .looseObject({
      Name: z.string(),
      Address: optionalStringSchema,
    })
    .optional(),
});

const trackingShipment = z.looseObject({
  Waybill: optionalStringSchema,
  Origin: optionalStringSchema,
  Destination: optionalStringSchema,
  PickupOptions: optionalNumberSchema,
  DeliveryType: optionalNumberSchema,
  MobileShipmentTrackings: z.array(trackingEvent).default([]),
});

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
