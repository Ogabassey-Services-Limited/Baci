import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveFeatureSettingsAccess } from './resolve-feature-settings-access';

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  resolveSelectedMerchantAccess: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: (...args: unknown[]) => mocks.hasPermission(...args),
}));

vi.mock('./resolve-selected-merchant-access', () => ({
  resolveSelectedMerchantAccess: (...args: unknown[]) =>
    mocks.resolveSelectedMerchantAccess(...args),
}));

const supabase = {} as SupabaseClient;
const access = { merchantId: 'merchant-123', role: 'owner' };

describe('resolveFeatureSettingsAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveSelectedMerchantAccess.mockResolvedValue({
      access,
      invalidMerchantId: false,
    });
  });

  it('resolves selected access once and accepts any permitted read capability', async () => {
    mocks.hasPermission.mockImplementation(
      (_access: unknown, resource: string) => resource === 'marketing'
    );

    const result = await resolveFeatureSettingsAccess({
      requestedMerchantId: '22222222-2222-4222-8222-222222222222',
      permission: 'read',
      supabase,
      userId: 'user-1',
    });

    expect(result).toEqual({ access, error: null });
    expect(mocks.resolveSelectedMerchantAccess).toHaveBeenCalledWith({
      requestedMerchantId: '22222222-2222-4222-8222-222222222222',
      supabase,
      userId: 'user-1',
    });
    expect(mocks.hasPermission).toHaveBeenCalledWith(
      access,
      'settings',
      'view'
    );
    expect(mocks.hasPermission).toHaveBeenCalledWith(
      access,
      'marketing',
      'view'
    );
  });

  it('returns the existing invalid merchant response before checking permissions', async () => {
    mocks.resolveSelectedMerchantAccess.mockResolvedValue({
      access: null,
      invalidMerchantId: true,
    });

    const result = await resolveFeatureSettingsAccess({
      requestedMerchantId: null,
      permission: 'edit',
      supabase,
      userId: 'user-1',
    });

    expect(result).toEqual({
      access: null,
      error: { message: 'Invalid merchant ID', status: 400 },
    });
    expect(mocks.hasPermission).not.toHaveBeenCalled();
  });

  it('requires settings edit permission for mutation requests', async () => {
    mocks.hasPermission.mockReturnValue(false);

    const result = await resolveFeatureSettingsAccess({
      requestedMerchantId: undefined,
      permission: 'edit',
      supabase,
      userId: 'user-1',
    });

    expect(result).toEqual({
      access: null,
      error: { message: 'Permission denied', status: 403 },
    });
    expect(mocks.hasPermission).toHaveBeenCalledWith(
      access,
      'settings',
      'edit'
    );
  });
});
