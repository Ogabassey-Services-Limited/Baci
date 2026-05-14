import { describe, expect, it } from 'vitest';
import { auditMerchantBranches } from '@/scripts/audit-merchant-branches';

describe('auditMerchantBranches', () => {
  it('handles an empty branch list', () => {
    const audit = auditMerchantBranches([]);

    expect(audit).toEqual({
      activeBranches: [],
      activeFlaggedBranches: [],
      inactiveFlaggedBranches: [],
      hasActiveCleanupFailure: false,
    });
  });

  it('keeps all inactive non-test branches out of flagged cleanup lists', () => {
    const audit = auditMerchantBranches([
      {
        id: 'branch-1',
        name: 'Lagos main',
        active: false,
        is_default: false,
      },
    ]);

    expect(audit.activeBranches).toEqual([]);
    expect(audit.activeFlaggedBranches).toEqual([]);
    expect(audit.inactiveFlaggedBranches).toEqual([]);
    expect(audit.hasActiveCleanupFailure).toBe(false);
  });

  it('flags inactive test branches without failing active cleanup', () => {
    const audit = auditMerchantBranches([
      {
        id: 'branch-1',
        name: 'Lagos main',
        active: true,
        is_default: true,
      },
      {
        id: 'branch-2',
        name: 'Test Branch',
        active: false,
        is_default: false,
      },
    ]);

    expect(audit.activeBranches).toEqual([
      {
        id: 'branch-1',
        name: 'Lagos main',
        isDefault: true,
      },
    ]);
    expect(audit.inactiveFlaggedBranches).toEqual([
      {
        id: 'branch-2',
        name: 'Test Branch',
      },
    ]);
    expect(audit.activeFlaggedBranches).toEqual([]);
    expect(audit.hasActiveCleanupFailure).toBe(false);
  });

  it('fails cleanup when a test branch is still active', () => {
    const audit = auditMerchantBranches([
      {
        id: 'branch-1',
        name: 'Demo branch',
        active: true,
        is_default: false,
      },
    ]);

    expect(audit.activeFlaggedBranches).toEqual([
      {
        id: 'branch-1',
        name: 'Demo branch',
      },
    ]);
    expect(audit.activeBranches).toEqual([
      {
        id: 'branch-1',
        name: 'Demo branch',
        isDefault: false,
      },
    ]);
    expect(audit.inactiveFlaggedBranches).toEqual([]);
    expect(audit.hasActiveCleanupFailure).toBe(true);
  });

  it('categorizes active and inactive test branches from mixed branch lists', () => {
    const audit = auditMerchantBranches([
      {
        id: 'branch-1',
        name: 'Lagos main',
        active: true,
        is_default: true,
      },
      {
        id: 'branch-2',
        name: 'Test Branch',
        active: true,
        is_default: false,
      },
      {
        id: 'branch-3',
        name: 'Demo Branch',
        active: false,
        is_default: false,
      },
      {
        id: 'branch-4',
        name: 'Old branch',
        active: false,
        is_default: false,
      },
    ]);

    expect(audit.activeBranches).toEqual([
      { id: 'branch-1', name: 'Lagos main', isDefault: true },
      { id: 'branch-2', name: 'Test Branch', isDefault: false },
    ]);
    expect(audit.activeFlaggedBranches).toEqual([
      { id: 'branch-2', name: 'Test Branch' },
    ]);
    expect(audit.inactiveFlaggedBranches).toEqual([
      { id: 'branch-3', name: 'Demo Branch' },
    ]);
    expect(audit.hasActiveCleanupFailure).toBe(true);
  });
});
