import {
  PAYMENT_METHOD_SETTING_DEFINITIONS,
  getPaymentMethodSettingSelectColumns,
  type PaymentMethodEnabledField,
  type PaymentMethodSettingCategory,
  type PaymentMethodSettingDefinition,
} from '@baci/shared';
import type { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';

export type PaymentSettings = {
  id: string;
  merchant_id: string;
  pay_on_delivery_limit?: number | null;
} & Partial<Record<PaymentMethodEnabledField, boolean>>;

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

const paymentSettingsRecordSchema = z.record(z.string(), z.unknown());
const paymentSettingsBaseSchema = z.object({
  id: z.string(),
  merchant_id: z.string(),
});
const paymentSettingLimitSchema = z.union([z.number(), z.null()]);
const paymentSettingEnabledSchema = z
  .union([z.boolean(), z.null()])
  .optional()
  .transform((value) => value ?? false);

export function parsePaymentSettings(
  value: unknown,
  definitions: readonly PaymentMethodSettingDefinition[] = PAYMENT_METHOD_SETTING_DEFINITIONS
): PaymentSettings {
  const recordResult = paymentSettingsRecordSchema.safeParse(value);
  if (!recordResult.success) {
    throw new Error('Invalid payment settings response');
  }

  const baseResult = paymentSettingsBaseSchema.safeParse(recordResult.data);
  if (!baseResult.success) {
    const field = baseResult.error.issues[0]?.path[0];
    throw new Error(
      `Invalid payment setting: ${field ? String(field) : 'response'}`
    );
  }

  const settings: PaymentSettings = {
    id: baseResult.data.id,
    merchant_id: baseResult.data.merchant_id,
  };

  if ('pay_on_delivery_limit' in recordResult.data) {
    const limitResult = paymentSettingLimitSchema.safeParse(
      recordResult.data.pay_on_delivery_limit
    );
    if (!limitResult.success) {
      throw new Error('Invalid payment setting: pay_on_delivery_limit');
    }
    settings.pay_on_delivery_limit = limitResult.data;
  }

  for (const definition of definitions) {
    const fieldResult = paymentSettingEnabledSchema.safeParse(
      recordResult.data[definition.enabledField]
    );
    if (!fieldResult.success) {
      throw new Error(`Invalid payment setting: ${definition.enabledField}`);
    }
    settings[definition.enabledField] = fieldResult.data;
  }

  return settings;
}

export const paymentMethods = buildPaymentMethods();

export const paymentSettingsSelectColumns = getPaymentSettingsSelectColumns();
