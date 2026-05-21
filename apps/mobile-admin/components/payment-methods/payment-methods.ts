import {
  PAYMENT_METHOD_SETTING_DEFINITIONS,
  getPaymentMethodSettingSelectColumns,
  type PaymentMethodEnabledField,
  type PaymentMethodSettingCategory,
  type PaymentMethodSettingDefinition,
} from '@baci/shared';
import type { Ionicons } from '@expo/vector-icons';
import type { PaymentSettings } from '@/schemas/payment-settings';

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

export function getPaymentMethodDefinitionsForColumns(
  columns: readonly string[],
  definitions: readonly PaymentMethodSettingDefinition[] = PAYMENT_METHOD_SETTING_DEFINITIONS
): readonly PaymentMethodSettingDefinition[] {
  const selectedColumns = new Set(columns);
  return definitions.filter((definition) =>
    selectedColumns.has(definition.enabledField)
  );
}

export function getRenderablePaymentMethods(
  settings: PaymentSettings | undefined,
  methods: readonly Readonly<PaymentMethod>[] = paymentMethods
): readonly Readonly<PaymentMethod>[] {
  if (!settings) return [];

  return methods.filter((method) =>
    Object.prototype.hasOwnProperty.call(settings, method.dbField)
  );
}

export const paymentMethods = buildPaymentMethods();

export const paymentSettingsSelectColumns = getPaymentSettingsSelectColumns();
