import { formatCurrencyNoDecimals } from '@/lib/utils';

// Re-export using the cached implementation (with no decimals as the original behavior)
export const formatCurrency = (amount: number) =>
  formatCurrencyNoDecimals(amount);
export { formatCurrencyNoDecimals };
