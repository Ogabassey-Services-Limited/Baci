import type { Ionicons } from '@expo/vector-icons';

export interface PaymentSettings {
  id: string;
  merchant_id: string;
  paystack_enabled: boolean;
  korapay_enabled: boolean;
  credit_direct_enabled: boolean;
  credpal_enabled: boolean;
  pay_on_delivery_enabled: boolean;
  pay_on_delivery_limit?: number | null;
  juicyway_enabled: boolean;
}

export type PaymentMethodCategory = 'gateway' | 'bnpl' | 'offline';

export type PaymentMethodField =
  | 'paystack_enabled'
  | 'korapay_enabled'
  | 'credit_direct_enabled'
  | 'credpal_enabled'
  | 'pay_on_delivery_enabled'
  | 'juicyway_enabled';

export interface PaymentMethod {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  dbField: PaymentMethodField;
  category: PaymentMethodCategory;
}

export const paymentMethods: readonly Readonly<PaymentMethod>[] = [
  {
    id: 'paystack',
    name: 'Paystack',
    icon: 'card-outline',
    description: 'Cards, bank transfer, USSD & mobile money',
    dbField: 'paystack_enabled',
    category: 'gateway',
  },
  {
    id: 'korapay',
    name: 'Korapay',
    icon: 'wallet-outline',
    description: 'Card payments and bank transfers',
    dbField: 'korapay_enabled',
    category: 'gateway',
  },
  {
    id: 'juicyway',
    name: 'Juicy Way',
    icon: 'flash-outline',
    description: 'Crypto/Stablecoin payments',
    dbField: 'juicyway_enabled',
    category: 'gateway',
  },
  {
    id: 'credpal',
    name: 'CredPal',
    icon: 'calendar-outline',
    description: 'Buy now, pay later in installments',
    dbField: 'credpal_enabled',
    category: 'bnpl',
  },
  {
    id: 'credit_direct',
    name: 'Credit Direct',
    icon: 'time-outline',
    description: 'Flexible BNPL payment plans',
    dbField: 'credit_direct_enabled',
    category: 'bnpl',
  },
  {
    id: 'pay_on_delivery',
    name: 'Pay on Delivery',
    icon: 'cash-outline',
    description: 'Cash payment when order arrives',
    dbField: 'pay_on_delivery_enabled',
    category: 'offline',
  },
];
