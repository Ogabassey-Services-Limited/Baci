import { apiClient } from '@/lib/api-client';
import {
  BranchSchema,
  CreateBranchSchema,
  type Branch,
  type CreateBranchInput,
  type UpdateBranchInput,
  UpdateBranchSchema,
} from '@/schemas/branch';

function parseBranchResponse(response: unknown): Branch {
  if (!response || typeof response !== 'object' || !('branch' in response)) {
    throw new Error('Branch response missing branch payload');
  }

  return BranchSchema.parse(response.branch);
}

export async function createBranch(input: CreateBranchInput): Promise<Branch> {
  const payload = CreateBranchSchema.parse(input);
  const response = await apiClient('/api/branches', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return parseBranchResponse(response);
}

export async function updateBranch(
  branchId: string,
  input: UpdateBranchInput
): Promise<Branch> {
  const trimmedBranchId = branchId.trim();
  if (!trimmedBranchId) {
    throw new Error('branchId is required');
  }

  const payload = UpdateBranchSchema.parse(input);
  const response = await apiClient(
    `/api/branches/${encodeURIComponent(trimmedBranchId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );

  return parseBranchResponse(response);
}

export async function deactivateBranch(branchId: string): Promise<void> {
  const trimmedBranchId = branchId.trim();
  if (!trimmedBranchId) {
    throw new Error('branchId is required');
  }

  await apiClient(`/api/branches/${encodeURIComponent(trimmedBranchId)}`, {
    method: 'DELETE',
  });
}
