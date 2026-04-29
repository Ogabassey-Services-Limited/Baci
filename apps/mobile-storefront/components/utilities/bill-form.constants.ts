import type { BillType } from '@/hooks/use-vtu-billers';
import type { BillFormProps } from './bill-form.types';

type BillFormUtilityType = BillFormProps['type'];

export const BILL_TYPE_MAP = {
  tv: 'cable_tv',
  power: 'electricity',
  gaming: 'betting',
} as const satisfies Record<BillFormUtilityType, BillType>;

export type BillCategory = keyof typeof BILL_TYPE_MAP;

export const IDENTIFIER_LABELS = {
  tv: 'Smart Card Number',
  power: 'Meter Number',
  gaming: 'Account ID',
} as const satisfies Record<BillCategory, string>;

export const IDENTIFIER_PLACEHOLDERS = {
  tv: 'Enter smart card number',
  power: 'Enter meter number',
  gaming: 'Enter account ID',
} as const satisfies Record<BillCategory, string>;

export const BILL_ITEM_LABELS = {
  tv: 'Package',
  power: 'Meter Type',
  gaming: 'Service Type',
} as const satisfies Record<BillCategory, string>;

// TODO(design-tokens): replace these pixel fallbacks with footer/safe-area
// layout tokens once the mobile design system exposes them.
/** Height in pixels reserved for the fixed payment footer and safe-area padding. */
export const BILL_FORM_FOOTER_HEIGHT = 120;
/** Extra pixel buffer so validation errors do not sit under the fixed footer. */
export const BILL_FORM_FOOTER_ERROR_BUFFER = 36;
