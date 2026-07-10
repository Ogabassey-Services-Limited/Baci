import { Briefcase, Lock, Shield, Sparkles } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { getImeiResultStatusCards } from './imei-checker-status-cards';
import type { ImeiResult } from './imei-checker-types';

function baseResult(overrides: Partial<ImeiResult> = {}): ImeiResult {
  return {
    imei: '490154203237518',
    device: 'iPhone 13 Pro',
    modelNumber: 'A2638',
    status: 'Clean',
    icloud: 'Off',
    icloudLock: 'Off',
    simLock: 'Unlocked',
    blacklistStatus: 'Clean',
    carrier: 'Unlocked',
    deviceImage: '',
    score: 98,
    deviceType: 'apple',
    verdict: 'Safe to buy',
    verdictType: 'safe',
    ...overrides,
  };
}

describe('getImeiResultStatusCards', () => {
  it('gates core cards on checksIncluded — omits Blacklist/iCloud/SIM/Carrier when not checked', () => {
    const result = baseResult();
    const cards = getImeiResultStatusCards(result, ['device']);

    expect(cards.find((c) => c.label === 'Blacklist Status')).toBeUndefined();
    expect(cards.find((c) => c.label === 'iCloud Status')).toBeUndefined();
    expect(cards.find((c) => c.label === 'Find My iPhone')).toBeUndefined();
    expect(cards.find((c) => c.label === 'SIM Lock')).toBeUndefined();
    expect(cards.find((c) => c.label === 'Carrier')).toBeUndefined();
  });

  it('shows core cards when checksIncluded includes them, colored by cleanliness', () => {
    const result = baseResult({ blacklistStatus: 'Blacklisted' });
    const cards = getImeiResultStatusCards(result, [
      'blacklistStatus',
      'icloud',
      'simLock',
      'carrier',
    ]);

    const blacklist = cards.find((c) => c.label === 'Blacklist Status');
    expect(blacklist?.toneKey).toBe('danger');
    expect(cards.find((c) => c.label === 'iCloud Status')?.toneKey).toBe('safe');
    expect(cards.find((c) => c.label === 'Find My iPhone')?.toneKey).toBe('safe');
    expect(cards.find((c) => c.label === 'SIM Lock')?.toneKey).toBe('accent');
    expect(cards.find((c) => c.label === 'Carrier')?.toneKey).toBe('accent');
  });

  it('shows optional extended fields only when the provider returned a value, regardless of tier', () => {
    const result = baseResult({ knoxGuardStatus: 'Active' });
    const cards = getImeiResultStatusCards(result, ['device']);

    const knox = cards.find((c) => c.label === 'Knox Guard');
    expect(knox).toBeDefined();
    expect(knox?.toneKey).toBe('danger');
    expect(cards.find((c) => c.label === 'MDM Status')).toBeUndefined();
  });

  it('renders activation status with its fixed primary tone', () => {
    const result = baseResult({ activationStatus: 'Not Activated' });
    const cards = getImeiResultStatusCards(result, ['device']);

    expect(cards.find((c) => c.label === 'Activation Status')).toMatchObject({
      icon: Sparkles,
      value: 'Not Activated',
      toneKey: 'primary',
    });
  });

  it('renders MDM status with a clean-aware tone', () => {
    const result = baseResult({ mdmStatus: 'Not Locked' });
    const cards = getImeiResultStatusCards(result, ['device']);

    expect(cards.find((c) => c.label === 'MDM Status')).toMatchObject({
      icon: Briefcase,
      value: 'Not Locked',
      toneKey: 'safe',
    });
  });

  it('keeps Mi Lock bound to its lock icon, value, and clean-aware tone', () => {
    const result = baseResult({
      miLockStatus: 'Locked',
      miLostStatus: 'Clean',
    });
    const cards = getImeiResultStatusCards(result, ['device']);

    expect(cards.find((c) => c.label === 'Mi Lock Status')).toMatchObject({
      icon: Lock,
      value: 'Locked',
      toneKey: 'danger',
    });
  });

  it('keeps Mi Lost bound to its shield icon, value, and clean-aware tone', () => {
    const result = baseResult({
      miLockStatus: 'Locked',
      miLostStatus: 'Clean',
    });
    const cards = getImeiResultStatusCards(result, ['device']);

    expect(cards.find((c) => c.label === 'Mi Lost Status')).toMatchObject({
      icon: Shield,
      value: 'Clean',
      toneKey: 'safe',
    });
  });

  it('renders gsxCoverage, repairEligibility, and partNumber as neutral/muted, never cleanAware', () => {
    const result = baseResult({
      gsxCoverage: 'Expired',
      repairEligibility: 'Eligible',
      partNumber: 'MQ8X3LL/A',
    });
    const cards = getImeiResultStatusCards(result, ['device']);

    expect(cards.find((c) => c.label === 'Coverage')?.toneKey).toBe('muted');
    expect(cards.find((c) => c.label === 'Repair Eligibility')?.toneKey).toBe(
      'muted'
    );
    expect(cards.find((c) => c.label === 'Part Number')?.toneKey).toBe(
      'muted'
    );
  });

  it('renders warranty in a fixed safe tone regardless of its literal value', () => {
    const result = baseResult({ warranty: 'Out of warranty' });
    const cards = getImeiResultStatusCards(result, ['device']);

    expect(cards.find((c) => c.label === 'Warranty')?.toneKey).toBe('safe');
  });

  it('treats benign repair/replacement history values as safe', () => {
    const result = baseResult({
      repairHistory: 'No Repairs',
      replacementHistory: 'Not Replaced',
    });
    const cards = getImeiResultStatusCards(result, ['device']);

    expect(cards.find((c) => c.label === 'Repair History')?.toneKey).toBe(
      'safe'
    );
    expect(
      cards.find((c) => c.label === 'Replacement History')?.toneKey
    ).toBe('safe');
  });
});
