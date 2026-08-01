export interface StaffAccount {
  id: string;
  code: string;
  name: string;
  account_number: string | null;
  account_name: string | null;
  bank: string | null;
  payment_link: string | null;
  active: boolean;
  staff_id: string | null;
  branch_id: string | null;
  staff_members?: { id: string; full_name: string } | null;
  branches?: { id: string; name: string } | null;
}

export interface Branch {
  id: string;
  name: string;
  address?: string;
  city?: string;
  is_default: boolean;
  active: boolean;
}

export interface StaffMember {
  id: string;
  full_name: string;
}

export interface NewStaffAccount {
  name: string;
  staffId: string;
  branchId: string;
}

export interface NewBranch {
  name: string;
  address: string;
  city: string;
}
