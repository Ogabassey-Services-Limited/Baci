import { describe, expect, it } from 'vitest';
import { UpgradeModalProvider, useUpgradeModal } from './upgrade-modal';

describe('UpgradeModal', () => {
  it('exports UpgradeModalProvider', () => {
    expect(UpgradeModalProvider).toBeDefined();
    expect(typeof UpgradeModalProvider).toBe('function');
  });

  it('exports useUpgradeModal hook', () => {
    expect(useUpgradeModal).toBeDefined();
    expect(typeof useUpgradeModal).toBe('function');
  });
});
