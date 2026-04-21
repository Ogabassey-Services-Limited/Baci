import type { Customer } from '@/hooks/useCustomers';
import type { Product } from '@/hooks/useProducts';
import type { SelectableManualOrderProduct } from '@/lib/manual-order-line-item';

export interface ShippingAddress {
  name: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
}

export interface OrderItem {
  id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  price: number;
  condition?: string;
  image_url?: string;
  details?: string;
  is_custom?: boolean;
  variant_id: string | null;
  variant_name: string | null;
}

export interface CustomerInfo {
  id: string | null;
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface DeliveryInfo {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
}

export interface NewCustomerDraft {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
}

export interface CustomItemDraft {
  name: string;
  price: string;
}

export interface FinancialModalState {
  type: 'discount' | 'shipping' | 'tax';
  visible: boolean;
}

export type SelectableCustomer = Pick<
  Customer,
  'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'address'
>;

export type SelectableOrderProduct = SelectableManualOrderProduct;

export type SelectedParentProduct = Product | null;
