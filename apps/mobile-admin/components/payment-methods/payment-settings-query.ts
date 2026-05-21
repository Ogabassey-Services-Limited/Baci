import { supabase } from '@/lib/supabase';
import {
  type PaymentSettings,
  parsePaymentSettings,
} from '@/schemas/payment-settings';
import { getPaymentMethodDefinitionsForColumns } from './payment-methods';

const REQUIRED_PAYMENT_SETTINGS_COLUMNS = new Set(['id', 'merchant_id']);

type PostgrestErrorShape = {
  message?: string;
  details?: string;
  hint?: string;
};

function getMissingColumnFromPostgrestError(
  error: PostgrestErrorShape | null | undefined
): string | null {
  if (!error) return null;

  const text = [error.message, error.details, error.hint]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');

  if (!text) return null;

  const postgrestMatch = text.match(
    /Could not find the ['"]([^'"]+)['"] column/i
  );
  if (postgrestMatch?.[1]) {
    return postgrestMatch[1];
  }

  const postgresMatch = text.match(
    /column\s+\w+\.("?)([a-zA-Z0-9_]+)\1\s+does not exist/i
  );
  return postgresMatch?.[2] ?? null;
}

export async function fetchPaymentSettings(
  merchantId: string,
  columns: string
): Promise<PaymentSettings> {
  let selectColumns = Array.from(
    new Set(
      columns
        .split(',')
        .map((column) => column.trim())
        .filter((column) => column.length > 0)
    )
  );

  const maxAttempts = selectColumns.length;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data, error } = await supabase
      .from('merchant_feature_settings')
      .select(selectColumns.join(', '))
      .eq('merchant_id', merchantId)
      .single();

    if (!error) {
      return parsePaymentSettings(
        data,
        getPaymentMethodDefinitionsForColumns(selectColumns)
      );
    }

    const missingColumn = getMissingColumnFromPostgrestError(error);
    if (
      !missingColumn ||
      !selectColumns.includes(missingColumn) ||
      REQUIRED_PAYMENT_SETTINGS_COLUMNS.has(missingColumn)
    ) {
      throw error;
    }

    const remainingColumns = selectColumns.filter(
      (column) => column !== missingColumn
    );
    if (remainingColumns.length === 0) {
      throw error;
    }

    selectColumns = remainingColumns;
  }

  throw new Error('Unable to load payment settings');
}
