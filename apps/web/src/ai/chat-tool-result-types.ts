/**
 * Shared result shapes for the AI chat tool handlers.
 *
 * Extracted so the handler groups (search/product, payment, recommendation)
 * can live in focused modules without a circular dependency on each other.
 */

export interface ProductSearchResult {
  id: string;
  name: string;
  price: number;
  description: string | null;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  stock: number | null;
  status: string;
}

export interface VirtualAccountResult {
  success: boolean;
  orderId?: string;
  accountNumber?: string;
  bankName?: string;
  accountName?: string;
  amount?: number;
  expiresAt?: string;
  error?: string;
}

export interface PaymentStatusResult {
  status: 'pending' | 'paid' | 'expired' | 'not_found';
  orderId?: string;
  paidAt?: string;
  amount?: number;
  accountNumber?: string;
  bankName?: string;
}
