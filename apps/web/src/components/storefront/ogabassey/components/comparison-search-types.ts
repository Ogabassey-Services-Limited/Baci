import type { Product, ProductSpecSection } from '../types';

export interface SearchResultProduct {
  id: string | number;
  name: string;
  slug?: string;
  price: number;
  image?: string;
  imageLarge?: string;
  description?: string;
  rating?: number;
  category?: string;
  condition?: string;
  brand?: string;
  product_key_specs?: Product['product_key_specs'];
  specifications?: ProductSpecSection[];
  variant_attributes?: Product['variant_attributes'];
}
