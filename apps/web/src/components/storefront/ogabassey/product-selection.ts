import { requiresProductSelection } from '@baci/shared/lib';
import type { Product } from './types';

export function requiresOgabasseyProductSelection(product: Product) {
  return requiresProductSelection(product);
}
