import type { BillType } from '@/hooks/use-vtu-billers';

export const BILL_TYPE_MAP = {
  tv: 'cable_tv',
  power: 'electricity',
  gaming: 'betting',
} as const satisfies Record<'tv' | 'power' | 'gaming', BillType>;

export const IDENTIFIER_LABELS: Record<string, string> = {
  tv: 'Smart Card Number',
  power: 'Meter Number',
  gaming: 'Account ID',
};

export const IDENTIFIER_PLACEHOLDERS: Record<string, string> = {
  tv: 'Enter smart card number',
  power: 'Enter meter number',
  gaming: 'Enter account ID',
};

export const BILL_ITEM_LABELS: Record<string, string> = {
  tv: 'Package',
  power: 'Meter Type',
  gaming: 'Service Type',
};

export const BILL_FORM_FOOTER_HEIGHT = 120;
export const BILL_FORM_FOOTER_ERROR_BUFFER = 36;
