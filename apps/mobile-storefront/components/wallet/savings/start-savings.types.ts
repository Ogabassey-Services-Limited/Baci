import type { Product } from '@/types/product';

export type SavingsSearchParams = {
  productId?: string | string[];
  targetAmount?: string | string[];
  variantId?: string | string[];
};

export type SavingsProductChoice = Pick<
  Product,
  'id' | 'name' | 'price' | 'slug'
>;
export type SavingsSourceMode = 'manual' | 'auto_debit';
export type StartSavingsColors = {
  background: string;
  border: string;
  card: string;
  error: string;
  placeholder: string;
  primary: string;
  text: string;
  textSecondary: string;
};
