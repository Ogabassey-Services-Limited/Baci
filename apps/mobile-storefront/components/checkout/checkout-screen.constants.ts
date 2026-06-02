import { zodResolver } from '@hookform/resolvers/zod';
import Constants from 'expo-constants';
import type { Resolver } from 'react-hook-form';
import { resolveApiBaseUrl } from '@/lib/api-url';
import {
  type ShippingAddressInput,
  ShippingAddressSchema,
} from '@/lib/validation';
import type { OrderResponse } from '@/services/orders';

export const shippingAddressResolver = zodResolver(
  ShippingAddressSchema as unknown as Parameters<typeof zodResolver>[0]
) as unknown as Resolver<ShippingAddressInput>;

export interface PendingCryptoOrder {
  order: OrderResponse['order'];
  orderResponse: OrderResponse;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  trackingToken?: string;
}

export const CHECKOUT_API_BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl
);

export const CHECKOUT_MERCHANT_ID =
  Constants.expoConfig?.extra?.merchantId ||
  '6b5cb8a4-5575-456c-b936-8cdfae30db74';

export const CHECKOUT_MERCHANT_SLUG =
  Constants.expoConfig?.extra?.merchantSlug || 'ogabassey';

export const CHECKOUT_MERCHANT_DOMAIN =
  process.env.EXPO_PUBLIC_MERCHANT_DOMAIN ||
  Constants.expoConfig?.extra?.merchantDomain ||
  undefined;
