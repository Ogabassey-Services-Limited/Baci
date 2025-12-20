export interface Product {
  id: string | number;
  name: string;
  price: string;
  rawPrice: number;
  currency?: string;
  description: string;
  image: string;
  images?: string[]; // Array of images corresponding to colors
  category: string;
  rating: number;
  reviews?: number;
  condition?: 'New' | 'Used' | 'Open Box';
  brand?: string;
  colors?: string[];
  spec?: string; // Technical specification tag (e.g. "Physical + eSIM")
}

export interface ProductRecommendation {
  name: string;
  price: string;
  reason: string;
  category: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}