import type { StaffMember } from '@/lib/types/staff';

export function getStaffDisplayIdentity({
  email,
  name,
}: Pick<StaffMember, 'email' | 'name'>) {
  return name?.trim() || email?.trim() || 'Unknown User';
}
