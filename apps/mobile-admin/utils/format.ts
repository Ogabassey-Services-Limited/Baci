import { formatCurrency as formatCurrencyBase, formatCurrencyCompact } from '@/lib/utils';

// Re-export using the cached implementation (with no decimals as the original behavior)
export const formatCurrency = (amount: number) => formatCurrencyCompact(amount);
export { formatCurrencyCompact };
