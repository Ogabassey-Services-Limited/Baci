/**
 * Shared Staff Types
 * Used across API routes and UI components for team management
 */

export type StaffRole =
  | 'admin'
  | 'manager'
  | 'sales_rep'
  | 'inventory'
  | 'accountant'
  | 'customer_service'
  | 'marketing'
  | 'fulfillment';

export interface StaffMember {
  id: string;
  merchant_id?: string;
  user_id?: string | null;
  email: string;
  name: string | null;
  role: StaffRole;
  permissions?: Record<string, Record<string, boolean>>;
  status: 'pending' | 'active' | 'suspended' | 'removed';
  invited_at: string;
  accepted_at: string | null;
  last_login_at?: string | null;
  created_at?: string;
}
