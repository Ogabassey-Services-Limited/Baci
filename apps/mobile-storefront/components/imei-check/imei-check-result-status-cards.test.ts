import { describe, expect, it } from '@jest/globals';
import Colors from '@/constants/Colors';
import type { ImeiResult } from '@/lib/validation';
import { getImeiResultStatusCards } from './imei-check-result-status-cards';

const baseResult: ImeiResult = {
  imei: '490154203237518',
  device: 'Xiaomi 14',
  modelNumber: '23127PN0CC',
  status: 'Clean',
  icloud: 'Unknown',
  icloudLock: 'Unknown',
  simLock: 'Unlocked',
  blacklistStatus: 'Not Blacklisted',
  carrier: 'Unlocked',
  deviceImage: '',
  score: 94,
  deviceType: 'android',
  verdict: 'Safe to buy',
  verdictType: 'safe',
};

describe('getImeiResultStatusCards', () => {
  it('includes fixed status cards for every result', () => {
    const cards = getImeiResultStatusCards(baseResult, Colors.light);

    expect(cards.map((card) => card.label)).toEqual([
      'Blacklist Status',
      'Find My iPhone',
      'SIM Lock',
      'Carrier',
    ]);
  });

  it('includes extended and Xiaomi fields when present', () => {
    const cards = getImeiResultStatusCards(
      {
        ...baseResult,
        activationStatus: 'Activated',
        serialNumber: 'F2LDN12345',
        purchaseDate: '2025-09-22',
        purchaseCountry: 'Nigeria',
        warranty: 'Limited Warranty',
        refurbished: 'No',
        demoUnit: 'No',
        mdmStatus: 'OFF',
        miLockStatus: 'Locked',
        miLostStatus: 'Clean',
      },
      Colors.light
    );

    expect(cards.map((card) => card.label)).toEqual(
      expect.arrayContaining([
        'Activation Status',
        'Serial Number',
        'Purchase Date',
        'Purchase Country',
        'Warranty',
        'Refurbished',
        'Demo Unit',
        'MDM Status',
        'Mi Lock Status',
        'Mi Lost Status',
      ])
    );
  });

  it('omits optional status cards when provider fields are absent', () => {
    const cards = getImeiResultStatusCards(baseResult, Colors.light);
    const labels = cards.map((card) => card.label);

    expect(labels).not.toEqual(
      expect.arrayContaining([
        'Activation Status',
        'Serial Number',
        'MDM Status',
        'Mi Lock Status',
        'Mi Lost Status',
      ])
    );
  });

  it('omits optional status cards when provider fields are empty strings', () => {
    const cards = getImeiResultStatusCards(
      {
        ...baseResult,
        activationStatus: '',
        mdmStatus: '',
        serialNumber: '',
      },
      Colors.light
    );
    const labels = cards.map((card) => card.label);

    expect(labels).not.toEqual(
      expect.arrayContaining([
        'Activation Status',
        'Serial Number',
        'MDM Status',
      ])
    );
  });

  it('uses active theme colors for non-clean-aware status tints', () => {
    const cards = getImeiResultStatusCards(
      {
        ...baseResult,
        activationStatus: 'Activated',
        serialNumber: 'F2LDN12345',
        warranty: 'Limited Warranty',
      },
      Colors.dark
    );

    expect(
      cards.find((card) => card.label === 'Activation Status')
    ).toMatchObject({
      tint: Colors.dark.primary,
    });
    expect(cards.find((card) => card.label === 'SIM Lock')).toMatchObject({
      tint: Colors.dark.primary,
    });
    expect(cards.find((card) => card.label === 'Carrier')).toMatchObject({
      tint: Colors.dark.accent,
    });
    expect(cards.find((card) => card.label === 'Serial Number')).toMatchObject({
      tint: Colors.dark.textSecondary,
    });
    expect(cards.find((card) => card.label === 'Warranty')).toMatchObject({
      tint: Colors.dark.success,
    });
  });
});
