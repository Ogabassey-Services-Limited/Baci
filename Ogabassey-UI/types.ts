import React from 'react';

export interface ProductRecommendation {
  name: string;
  price: string;
  reason: string;
  category: string;
}

export interface Category {
  id: string;
  name: string;
  icon: React.ReactNode;
  color?: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  bgColor: string;
  textColor: string;
  size: 'large' | 'small';
}

export interface Product {
  id: number | string;
  name: string;
  price: string;
  rawPrice: number;
  image: string;
  description: string;
  rating: number;
  category: string;
  condition: 'New' | 'Used' | 'Open Box';
  // Detailed specs for filtering
  brand?: string;
  storage?: string;
  ram?: string;
  colors?: string[];
  simType?: string;
  displayType?: string;
  displaySize?: string;
  // New fields for Interactive Grid
  images?: string[]; 
  spec?: string;
  reviews?: number;
}

export interface CartItem extends Product {
  cartItemId: string; // Unique ID for cart entry (product ID + options)
  selectedColor?: string;
  selectedColorValue?: string;
  secondaryColor?: string;
  secondaryColorValue?: string;
  selectedStorage?: string;
  quantity: number;
  negotiatedPrice?: number;
  negotiationStatus?: 'none' | 'accepted';
  hasAssurance?: boolean;
}