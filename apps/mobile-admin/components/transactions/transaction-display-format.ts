interface TransactionDisplayFormatOptions {
  paymentMethod?: boolean;
}

function restoreAppleProductTokens(value: string) {
  return value.replace(/\biphone\b/gi, 'iPhone').replace(/\bipad\b/gi, 'iPad');
}

function sentenceCase(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();

  if (!normalized) {
    return '';
  }

  return restoreAppleProductTokens(
    `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
  );
}

export function formatTransactionDisplayText(
  value: string | null | undefined,
  options: TransactionDisplayFormatOptions = {}
) {
  const normalized = value?.trim().replace(/\s+/g, ' ') ?? '';

  if (!normalized) {
    return '';
  }

  if (options.paymentMethod) {
    const paymentKey = normalized.toLowerCase().replace(/[_-]+/g, ' ');

    if (paymentKey === 'transfer' || paymentKey === 'bank transfer') {
      return 'Bank Transfer';
    }
  }

  return sentenceCase(normalized);
}
