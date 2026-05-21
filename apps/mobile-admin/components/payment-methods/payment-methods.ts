import {
  PAYMENT_METHOD_SETTING_DEFINITIONS,
  getPaymentMethodSettingSelectColumns,
  type PaymentMethodEnabledField,
  type PaymentMethodSettingCategory,
  type PaymentMethodSettingDefinition,
} from '@baci/shared';
import type { Ionicons } from '@expo/vector-icons';

export interface PaymentSettings extends Record<string, unknown> {
  id: string;
  merchant_id: string;
  pay_on_delivery_limit?: number | null;
}

export type PaymentMethodCategory = PaymentMethodSettingCategory;

export type PaymentMethodField = PaymentMethodEnabledField;

export interface PaymentMethod {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  dbField: PaymentMethodField;
  category: PaymentMethodCategory;
}

const PAYMENT_METHOD_ICON_BY_ID: Partial<
  Record<string, keyof typeof Ionicons.glyphMap>
> = {
  credit_direct: 'time-outline',
  credpal: 'calendar-outline',
  juicyway: 'flash-outline',
  klump: 'calendar-outline',
  korapay: 'wallet-outline',
  pay_on_delivery: 'cash-outline',
  paystack: 'card-outline',
};

export function buildPaymentMethods(
  definitions: readonly PaymentMethodSettingDefinition[] = PAYMENT_METHOD_SETTING_DEFINITIONS
): readonly Readonly<PaymentMethod>[] {
  return definitions.map((definition) => ({
    id: definition.id,
    name: definition.name,
    icon: PAYMENT_METHOD_ICON_BY_ID[definition.id] ?? 'card-outline',
    description: definition.description,
    dbField: definition.enabledField,
    category: definition.category,
  }));
}

export function getPaymentSettingsSelectColumns(
  definitions: readonly PaymentMethodSettingDefinition[] = PAYMENT_METHOD_SETTING_DEFINITIONS
): string {
  return getPaymentMethodSettingSelectColumns(definitions);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parsePaymentSettings(
  value: unknown,
  definitions: readonly PaymentMethodSettingDefinition[] = PAYMENT_METHOD_SETTING_DEFINITIONS
): PaymentSettings {
  if (!isObjectRecord(value)) {
    throw new Error('Invalid payment settings response');
  }

  if (typeof value.id !== 'string') {
    throw new Error('Invalid payment setting: id');
  }

  if (typeof value.merchant_id !== 'string') {
    throw new Error('Invalid payment setting: merchant_id');
  }

  const settings: PaymentSettings = {
    id: value.id,
    merchant_id: value.merchant_id,
  };

  if (
    value.pay_on_delivery_limit === null ||
    typeof value.pay_on_delivery_limit === 'number'
  ) {
    settings.pay_on_delivery_limit = value.pay_on_delivery_limit;
  }

  for (const definition of definitions) {
    const fieldValue = value[definition.enabledField];
    if (typeof fieldValue !== 'boolean') {
      throw new Error(`Invalid payment setting: ${definition.enabledField}`);
    }
    settings[definition.enabledField] = fieldValue;
  }

  return settings;
}

export const paymentMethods = buildPaymentMethods();

export const paymentSettingsSelectColumns = getPaymentSettingsSelectColumns();
