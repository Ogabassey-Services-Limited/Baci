import type { StaffAccess } from './types';

export const defaultStaffAccess: StaffAccess = {
  isStaff: false,
  isOwner: false,
  role: null,
  permissions: {},
};

export const ownerStaffAccess: StaffAccess = {
  isStaff: false,
  isOwner: true,
  role: null,
  permissions: { full_access: { all: true } },
};
