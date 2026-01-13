/**
 * Staff Types
 * Shared types for staff management in mobile-admin
 */

export type StaffRole =
  | 'admin'
  | 'manager'
  | 'sales_rep'
  | 'inventory'
  | 'accountant'
  | 'customer_service'
  | 'marketing'
  | 'fulfillment'
  | 'blog_manager';

export type StaffStatus = 'pending' | 'active' | 'suspended' | 'removed';

export interface StaffMember {
  id: string;
  merchant_id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  role: StaffRole;
  status: StaffStatus;
  created_at: string;
  invited_at: string;
  accepted_at: string | null;
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Administrator',
  manager: 'Store Manager',
  sales_rep: 'Sales Representative',
  inventory: 'Inventory Manager',
  accountant: 'Accountant',
  customer_service: 'Support Specialist',
  marketing: 'Marketing Manager',
  fulfillment: 'Fulfillment Officer',
  blog_manager: 'Blog Manager',
};

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  admin: 'Full access to all features except billing',
  manager: 'Manage orders, products, customers, and marketing',
  sales_rep: 'Create orders and manage customers',
  inventory: 'Manage products and stock levels',
  accountant: 'View orders, reports, and analytics (read-only)',
  customer_service: 'Handle orders and customer inquiries',
  marketing: 'Manage marketing, discounts, and content',
  fulfillment: 'Process and ship orders',
  blog_manager: 'Manage blog posts and page content',
};

export const VALID_ROLES: StaffRole[] = [
  'admin',
  'manager',
  'sales_rep',
  'inventory',
  'accountant',
  'customer_service',
  'marketing',
  'fulfillment',
  'blog_manager',
];
