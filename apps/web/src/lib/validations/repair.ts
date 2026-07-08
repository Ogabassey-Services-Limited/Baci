import z from 'zod';

export const repairBookingSchema = z
  .object({
    customerName: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be less than 100 characters'),
    customerEmail: z.email({ error: 'Please enter a valid email address' }),
    customerPhone: z
      .string()
      .min(10, 'Phone number must be at least 10 digits')
      .regex(/^[+]?[\d\s-]{10,}$/, 'Please enter a valid phone number'),
    deviceType: z.enum(
      [
        'Smartphone',
        'Laptop',
        'Tablet',
        'Console',
        'Smartwatch',
        'Other',
      ] as const,
      { message: 'Please select a device type' }
    ),
    deviceModel: z
      .string()
      .min(2, 'Device model is required (e.g., "iPhone 13")'),
    issueDescription: z
      .string()
      .min(10, 'Please describe the issue in at least 10 characters'),
    preferredDate: z.string().optional(), // ISO date string
    serviceType: z
      .enum(['dropoff', 'pickup'] as const, {
        message: 'Please select how you want to proceed',
      })
      .default('dropoff'),
    pickupAddress: z.string().optional(), // Required if serviceType is 'pickup'
    // Optional catalogue links. When present the booking RPC validates the
    // active quote/device server-side and snapshots the price/label.
    deviceId: z.uuid().optional(),
    quoteId: z.uuid().optional(),
  })
  .refine(
    (data) => {
      // If pickup is selected, address is required
      if (
        data.serviceType === 'pickup' &&
        (!data.pickupAddress || data.pickupAddress.length < 5)
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Please enter a valid pickup address',
      path: ['pickupAddress'],
    }
  );

export type RepairBookingInput = z.infer<typeof repairBookingSchema>;
