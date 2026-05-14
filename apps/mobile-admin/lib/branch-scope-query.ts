import type { BranchScope } from '@/schemas/branch';

export function getBranchScopeKey(scope: BranchScope): string {
  return scope.type === 'branch' ? scope.branchId : 'all';
}

export function applyOrderBranchScope<
  Query extends { eq: (column: string, value: string) => Query },
>(query: Query, scope: BranchScope, column = 'branch_id'): Query {
  return scope.type === 'branch' ? query.eq(column, scope.branchId) : query;
}
