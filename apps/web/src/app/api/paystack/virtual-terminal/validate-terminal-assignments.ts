import type { SupabaseClient } from '@supabase/supabase-js';

type TerminalAssignments = {
  branchId?: string;
  staffId?: string;
};

type AssignmentValidationResult =
  | { error: null }
  | { error: string; status: 400 | 500 };

export async function validateTerminalAssignments(
  adminSupabase: Pick<SupabaseClient, 'from'>,
  merchantId: string,
  { branchId, staffId }: TerminalAssignments
): Promise<AssignmentValidationResult> {
  const assignments = [
    staffId
      ? {
          id: staffId,
          invalidMessage: 'Staff member does not belong to this merchant',
          queryErrorMessage: 'Failed to validate staff assignment',
          table: 'staff_members',
        }
      : null,
    branchId
      ? {
          id: branchId,
          invalidMessage: 'Branch does not belong to this merchant',
          queryErrorMessage: 'Failed to validate branch assignment',
          table: 'branches',
        }
      : null,
  ].filter((assignment) => assignment !== null);

  for (const assignment of assignments) {
    const { data, error } = await adminSupabase
      .from(assignment.table)
      .select('id')
      .eq('id', assignment.id)
      .eq('merchant_id', merchantId)
      .maybeSingle();

    if (error) {
      return { error: assignment.queryErrorMessage, status: 500 };
    }
    if (!data?.id) {
      return { error: assignment.invalidMessage, status: 400 };
    }
  }

  return { error: null };
}
