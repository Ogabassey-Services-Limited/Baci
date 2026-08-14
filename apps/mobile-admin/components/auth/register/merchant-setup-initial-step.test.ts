import { describe, expect, it } from 'vitest';
import { initialMerchantSetupStep } from './merchant-setup-initial-step';

describe('initialMerchantSetupStep', () => {
  it('starts on owner details when social signup is missing a name', () => {
    expect(initialMerchantSetupStep('', 'Lovelace')).toBe(1);
    expect(initialMerchantSetupStep('Ada', '')).toBe(1);
    expect(initialMerchantSetupStep('  ', '  ')).toBe(1);
  });

  it('skips owner details when email signup already collected the name', () => {
    expect(initialMerchantSetupStep('Ada', 'Lovelace')).toBe(2);
  });
});
