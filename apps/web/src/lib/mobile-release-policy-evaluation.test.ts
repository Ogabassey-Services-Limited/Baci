import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  evaluateNativeUpdateGate,
  parseVersion,
} from './mobile-release-policy-evaluation';

describe('parseVersion', () => {
  it('parses a dotted version into numeric parts', () => {
    expect(parseVersion('2.1.3')).toEqual([2, 1, 3]);
  });

  it('returns null for a null or empty input', () => {
    expect(parseVersion(null)).toBeNull();
    expect(parseVersion('')).toBeNull();
  });

  it('returns null for a non-numeric or negative part', () => {
    expect(parseVersion('2.x.0')).toBeNull();
    expect(parseVersion('2.-1.0')).toBeNull();
  });
});

describe('compareVersions', () => {
  it('orders versions of differing depth correctly', () => {
    expect(compareVersions('2.1.0', '2.1')).toBe(0);
    expect(compareVersions('2.1.1', '2.1')).toBe(1);
    expect(compareVersions('2.0.9', '2.1')).toBe(-1);
  });

  it('treats an unparseable side as equal (never gates)', () => {
    expect(compareVersions(null, '2.1.0')).toBe(0);
    expect(compareVersions('2.1.0', 'bad')).toBe(0);
  });
});

describe('evaluateNativeUpdateGate', () => {
  const permissive = {
    installedBuild: null,
    latestNativeBuild: null,
    minNativeBuild: null,
    minNativeVersion: null,
    nativeVersion: null,
  };

  it('is permissive (both false) when nothing is configured — safe pre-release default', () => {
    expect(evaluateNativeUpdateGate(permissive)).toEqual({
      nativeUpdateRecommended: false,
      nativeUpdateRequired: false,
    });
  });

  it('requires an update when the marketing version is below the minimum', () => {
    const result = evaluateNativeUpdateGate({
      ...permissive,
      minNativeVersion: '2.1.0',
      nativeVersion: '2.0.0',
    });

    expect(result.nativeUpdateRequired).toBe(true);
    expect(result.nativeUpdateRecommended).toBe(true);
  });

  it('requires an update when the installed build is below the minimum build', () => {
    const result = evaluateNativeUpdateGate({
      ...permissive,
      installedBuild: 600,
      minNativeBuild: 646,
    });

    expect(result.nativeUpdateRequired).toBe(true);
    expect(result.nativeUpdateRecommended).toBe(true);
  });

  it('does not require when the installed build meets the minimum build', () => {
    const result = evaluateNativeUpdateGate({
      ...permissive,
      installedBuild: 646,
      minNativeBuild: 646,
    });

    expect(result.nativeUpdateRequired).toBe(false);
  });

  it('recommends (not requires) when below the live build only', () => {
    const result = evaluateNativeUpdateGate({
      ...permissive,
      installedBuild: 600,
      latestNativeBuild: 646,
    });

    expect(result.nativeUpdateRequired).toBe(false);
    expect(result.nativeUpdateRecommended).toBe(true);
  });

  it('does not recommend on marketing version alone (no live-build signal)', () => {
    // LATEST_VERSION must never drive RECOMMENDED — it can be set ahead of the
    // store's live build and would prompt for an unreleased version.
    const result = evaluateNativeUpdateGate({
      ...permissive,
      installedBuild: 360,
      nativeVersion: '2.1.360',
    });

    expect(result.nativeUpdateRecommended).toBe(false);
  });

  it('ignores build gating when the installed build is unknown', () => {
    const result = evaluateNativeUpdateGate({
      ...permissive,
      installedBuild: null,
      latestNativeBuild: 646,
      minNativeBuild: 646,
    });

    expect(result).toEqual({
      nativeUpdateRecommended: false,
      nativeUpdateRequired: false,
    });
  });
});
