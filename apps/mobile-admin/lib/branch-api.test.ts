import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBranch, deactivateBranch, updateBranch } from './branch-api';

const mocks = vi.hoisted(() => ({
  apiClient: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mocks.apiClient(...args),
}));

const branch = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  merchant_id: '123e4567-e89b-42d3-a456-426614174001',
  name: 'Lagos main',
  address: null,
  city: 'Lagos',
  state: 'Lagos',
  phone: null,
  manager_id: null,
  is_default: true,
  active: true,
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z',
};

describe('branch-api', () => {
  beforeEach(() => {
    mocks.apiClient.mockReset();
  });

  it('creates branches through the web API using camelCase fields', async () => {
    mocks.apiClient.mockResolvedValueOnce({ success: true, branch });

    const result = await createBranch({
      name: 'Lagos main',
      city: 'Lagos',
      isDefault: true,
    });

    expect(mocks.apiClient).toHaveBeenCalledWith('/api/branches', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Lagos main',
        city: 'Lagos',
        isDefault: true,
      }),
    });
    expect(result).toEqual(branch);
  });

  it('updates branches through the web API', async () => {
    mocks.apiClient.mockResolvedValueOnce({ success: true, branch });

    const result = await updateBranch(branch.id, {
      name: 'Updated branch',
      managerId: null,
    });

    expect(mocks.apiClient).toHaveBeenCalledWith(`/api/branches/${branch.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated branch', managerId: null }),
    });
    expect(result).toEqual(branch);
  });

  it('deactivates branches through the web API delete route', async () => {
    mocks.apiClient.mockResolvedValueOnce({ success: true });

    const result = await deactivateBranch(branch.id);

    expect(mocks.apiClient).toHaveBeenCalledWith(`/api/branches/${branch.id}`, {
      method: 'DELETE',
    });
    expect(result).toBeUndefined();
  });

  it('propagates network errors from createBranch', async () => {
    mocks.apiClient.mockRejectedValueOnce(new Error('Network error'));

    await expect(createBranch({ name: 'Lagos main' })).rejects.toThrow(
      'Network error'
    );
  });

  it('rejects unsuccessful createBranch payloads without a branch', async () => {
    mocks.apiClient.mockResolvedValueOnce({
      success: false,
      error: 'Create failed',
    });

    await expect(createBranch({ name: 'Lagos main' })).rejects.toThrow(
      'Branch response missing branch payload'
    );
    expect(mocks.apiClient).toHaveBeenCalledWith('/api/branches', {
      method: 'POST',
      body: JSON.stringify({ name: 'Lagos main', isDefault: false }),
    });
  });

  it('propagates network errors from updateBranch', async () => {
    mocks.apiClient.mockRejectedValueOnce(new Error('Network error'));

    await expect(updateBranch(branch.id, { name: 'Updated' })).rejects.toThrow(
      'Network error'
    );
  });

  it('rejects unsuccessful updateBranch payloads without a branch', async () => {
    mocks.apiClient.mockResolvedValueOnce({
      success: false,
      error: 'Update failed',
    });

    await expect(updateBranch(branch.id, { name: 'Updated' })).rejects.toThrow(
      'Branch response missing branch payload'
    );
    expect(mocks.apiClient).toHaveBeenCalledWith(`/api/branches/${branch.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
    });
  });

  it('propagates network errors from deactivateBranch', async () => {
    mocks.apiClient.mockRejectedValueOnce(new Error('Network error'));

    await expect(deactivateBranch(branch.id)).rejects.toThrow('Network error');
  });

  it('rejects blank branch ids before calling the API', async () => {
    await expect(updateBranch(' ', { name: 'Updated' })).rejects.toThrow(
      'branchId is required'
    );
    await expect(deactivateBranch(' ')).rejects.toThrow('branchId is required');
    expect(mocks.apiClient).not.toHaveBeenCalled();
  });
});
