import type { IoniconsIconName } from '@react-native-vector-icons/ionicons/static';
import { z } from 'zod';

const providerIds = ['gigl', 'topship', 'shiip'] as const;
export const shippingProviderIdSchema = z.enum(providerIds);

export const AVAILABLE_PROVIDERS = [
  {
    id: 'gigl',
    name: 'GIG Logistics',
    description: 'Nationwide delivery with tracking',
    icon: 'cube-outline',
  },
  {
    id: 'topship',
    name: 'Topship',
    description: 'Fast local and international shipping',
    icon: 'airplane-outline',
  },
  {
    id: 'shiip',
    name: 'Shiip',
    description: 'Same-day and next-day delivery',
    icon: 'flash-outline',
  },
] as const satisfies readonly {
  id: z.infer<typeof shippingProviderIdSchema>;
  name: string;
  description: string;
  icon: IoniconsIconName;
}[];

export const shippingSettingsSchema = z.object({
  merchant_id: z.string().min(1),
  shipping_providers: z.array(shippingProviderIdSchema),
  free_shipping_threshold: z.number().nullable(),
});

export function parseShippingSettings(data: unknown) {
  const parsed = shippingSettingsSchema.safeParse(data);
  if (!parsed.success) {
    console.error(
      '[ShippingSettings] Invalid settings payload',
      parsed.error.flatten()
    );
    throw new Error('Invalid shipping settings payload');
  }

  return parsed.data;
}

export type ProviderId = z.infer<typeof shippingProviderIdSchema>;
export type ShippingProvider = (typeof AVAILABLE_PROVIDERS)[number];

export type ShippingSettings = z.infer<typeof shippingSettingsSchema>;
