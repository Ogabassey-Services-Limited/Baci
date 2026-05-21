import {
  PAYMENT_METHOD_SETTING_DEFINITIONS,
  type PaymentMethodEnabledField,
  type PaymentMethodSettingDefinition,
} from '@baci/shared';
import { z } from 'zod';

export type PaymentSettings = {
  id: string;
  merchant_id: string;
  pay_on_delivery_limit?: number | null;
} & Partial<Record<PaymentMethodEnabledField, boolean>>;

export const PaymentSettingsRecordSchema = z.record(z.string(), z.unknown());

export const PaymentSettingsBaseSchema = z.object({
  id: z.string(),
  merchant_id: z.string(),
});

export const PaymentSettingLimitSchema = z.union([z.number(), z.null()]);

export const PaymentSettingEnabledSchema = z
  .union([z.boolean(), z.null()])
  .optional()
  .transform((value) => value ?? false);

export function parsePaymentSettings(
  value: unknown,
  definitions: readonly PaymentMethodSettingDefinition[] = PAYMENT_METHOD_SETTING_DEFINITIONS
): PaymentSettings {
  const recordResult = PaymentSettingsRecordSchema.safeParse(value);
  if (!recordResult.success) {
    throw new Error('Invalid payment settings response');
  }

  const baseResult = PaymentSettingsBaseSchema.safeParse(recordResult.data);
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
    const limitResult = PaymentSettingLimitSchema.safeParse(
      recordResult.data.pay_on_delivery_limit
    );
    if (!limitResult.success) {
      throw new Error('Invalid payment setting: pay_on_delivery_limit');
    }
    settings.pay_on_delivery_limit = limitResult.data;
  }

  for (const definition of definitions) {
    const fieldResult = PaymentSettingEnabledSchema.safeParse(
      recordResult.data[definition.enabledField]
    );
    if (!fieldResult.success) {
      throw new Error(`Invalid payment setting: ${definition.enabledField}`);
    }
    settings[definition.enabledField] = fieldResult.data;
  }

  return settings;
}
