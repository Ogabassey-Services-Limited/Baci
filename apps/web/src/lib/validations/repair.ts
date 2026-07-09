import z from 'zod';

const preferredDatePattern =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/;

function isValidPreferredDate(value: string): boolean {
  const match = preferredDatePattern.exec(value);
  if (!match) {
    return false;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  const validDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!validDate) {
    return false;
  }

  if (hourText === undefined) {
    return true;
  }

  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = secondText === undefined ? 0 : Number(secondText);
  return (
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59
  );
}

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
    preferredDate: z
      .string()
      .trim()
      .refine(isValidPreferredDate, 'Please enter a valid preferred date')
      .optional(),
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
