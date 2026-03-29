/**
 * Shared types for staff account components
 */

import type { getShadows, ThemeColors } from '@/constants/theme';

export interface StaffAccount {
  id: string;
  code: string;
  name: string;
  account_number: string | null;
  account_name: string | null;
  bank: string | null;
  payment_link: string | null;
  active: boolean;
  branch_id: string | null;
  staff_id: string | null;
}

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  is_default: boolean;
  active: boolean;
}

export interface StaffColors {
  colors: ThemeColors;
  shadows: ReturnType<typeof getShadows>;
}
