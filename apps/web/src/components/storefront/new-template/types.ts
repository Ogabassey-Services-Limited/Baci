export interface Product {
  id: string;
  name: string;
  price: string | number;
  rawPrice?: number;
  image: string;
  category: string;
  slug?: string;
  category_slug?: string;
  categorySlug?: string;
  categories?: { name?: string; slug?: string } | null;
  rating: number;
  reviews: number;
  description?: string;
  brand?: string;
  inStock?: boolean;
  specs?: Record<string, string>;
  // Optional fields
  discount?: number;
  isNew?: boolean;
  originalPrice?: string | number;
  images?: string[];
  spec?: string;
  colors?: { name: string; value: string }[];
  storage?: string[];
  // Extended fields
  status?: string;
  manage_stock?: boolean;
  stock?: number;
  imageLarge?: string;
  simType?: string;
  displayType?: string;
  displaySize?: string;
  condition?: string;
}

export interface CartItem extends Product {
  quantity: number;
  variant_id?: string;
  variantColor?: string;
  variantStorage?: string;
}

export interface Category {
  id: string;
  name: string;
  image: string;
  itemCount: number;
}
