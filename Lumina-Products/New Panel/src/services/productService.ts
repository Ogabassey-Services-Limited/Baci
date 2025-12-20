import { Product } from '../types';
import { products as staticProducts } from '../../data/products';

// This service mimics a Supabase client interaction
export const productService = {
  async getProducts(): Promise<Product[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // In a real app, this would be:
    // const { data, error } = await supabase.from('products').select('*');
    return staticProducts;
  },

  async getProductById(id: string | number): Promise<Product | undefined> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return staticProducts.find(p => p.id.toString() === id.toString());
  }
};