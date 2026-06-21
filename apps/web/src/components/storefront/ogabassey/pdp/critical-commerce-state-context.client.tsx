'use client';

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
} from 'react';
import type { Product as CartProduct } from '@/lib/products';
import type { InitialCriticalVariantSelection } from './critical-commerce-selection';

export interface OgabasseyPdpCriticalCommerceProviderProps {
  cartProduct: CartProduct;
  children: ReactNode;
  initialVariantSelection?: InitialCriticalVariantSelection;
  variantAxes?: string[];
  variantAxisOptions?: Record<string, string[]>;
  variantCount: number;
}

export interface OgabasseyPdpCriticalCommerceState {
  canAddToCart: boolean;
  explicitSelectedAxes: string[];
  handleAddToCart: () => void;
  handleAttributeSelection: (axis: string, value: string) => void;
  isAtMaxQuantity: boolean;
  maxQuantity: number | null;
  productForCart: CartProduct;
  quantity: number;
  renderableVariantAxes: string[];
  selectedAttributes: Record<string, string>;
  setQuantity: Dispatch<SetStateAction<number>>;
  variantAxisOptions: Record<string, string[]>;
  variantCount: number;
  variants: CartProduct['variants'];
}

export const OgabasseyPdpCriticalCommerceContext =
  createContext<OgabasseyPdpCriticalCommerceState | null>(null);

export function useOgabasseyPdpCriticalCommerce() {
  const context = useContext(OgabasseyPdpCriticalCommerceContext);
  if (!context) {
    throw new Error(
      'Ogabassey PDP critical commerce components must be rendered inside OgabasseyPdpCriticalCommerceProvider.'
    );
  }

  return context;
}

export function useOptionalOgabasseyPdpCriticalCommerce() {
  return useContext(OgabasseyPdpCriticalCommerceContext);
}
