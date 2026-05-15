import { describe, expect, it } from 'vitest';
import { parseSickwResponse } from './sickw-parser';

describe('parseSickwResponse', () => {
  it('parses html line breaks into structured check fields', () => {
    const result = parseSickwResponse(
      [
        'Model Name: iPhone 15',
        'Model Number: A3090',
        'Blacklist Status: Clean',
        'Find My iPhone: OFF',
      ].join('<br>')
    );

    expect(result).toMatchObject({
      device: 'iPhone 15',
      modelNumber: 'A3090',
      blacklistStatus: 'Clean',
      icloudLock: 'OFF',
      deviceType: 'apple',
      verdictType: 'safe',
    });
  });

  it('downgrades stolen blacklist results to danger', () => {
    const result = parseSickwResponse(
      'Model Name: Samsung S24<br>Blacklist: Reported stolen'
    );

    expect(result.status).toBe('Blacklisted');
    expect(result.verdictType).toBe('danger');
    expect(result.deviceType).toBe('android');
    expect(result.score).toBeLessThan(100);
  });

  it('normalizes object payloads from beta provider responses', () => {
    const result = parseSickwResponse({
      'Model Name': 'Samsung S24',
      Blacklist: 'Clean',
      Extra: 'Ignored',
    });

    expect(result).toMatchObject({
      blacklistStatus: 'Clean',
      device: 'Samsung S24',
      deviceType: 'android',
      verdictType: 'safe',
    });
  });

  it('sanitizes nested and encoded html from provider fields', () => {
    const result = parseSickwResponse(
      'Model Name: &lt;b&gt;iPhone 15&lt;/b&gt;<br>Blacklist Status: <div><p>Clean</p></div>'
    );

    expect(result.device).toBe('iPhone 15');
    expect(result.blacklistStatus).toBe('Clean');
  });

  it('returns incomplete caution data for empty or malformed strings', () => {
    expect(parseSickwResponse('')).toMatchObject({
      status: 'Unknown',
      verdictType: 'caution',
      score: 90,
    });

    expect(
      parseSickwResponse('not a provider key value response')
    ).toMatchObject({
      status: 'Unknown',
      verdictType: 'caution',
    });
  });

  it('handles nullish runtime inputs without throwing', () => {
    expect(parseSickwResponse(null as never)).toMatchObject({
      status: 'Unknown',
      verdictType: 'caution',
    });
    expect(parseSickwResponse(undefined as never)).toMatchObject({
      status: 'Unknown',
      verdictType: 'caution',
    });
  });

  it('keeps unknown blacklist values from forcing danger verdicts', () => {
    const result = parseSickwResponse(
      'Model Name: Pixel 8<br>Blacklist Status:   Not found   '
    );

    expect(result.status).toBe('Clean');
    expect(result.verdictType).toBe('safe');
    expect(result.deviceType).toBe('android');
  });

  it('does not treat unlocked or not-blacklisted values as risk tokens', () => {
    const result = parseSickwResponse(
      [
        'Model Name: iPhone 15',
        'Blacklist Status: Not Blacklisted',
        'Find My iPhone: Unlocked',
        'iCloud Status: Not Lost',
        'SIM Lock: Unlocked',
      ].join('<br>')
    );

    expect(result.status).toBe('Clean');
    expect(result.verdictType).toBe('safe');
    expect(result.score).toBe(100);
  });

  it('surfaces Xiaomi lock status as a caution verdict', () => {
    const result = parseSickwResponse(
      'Model Name: Xiaomi 14<br>MI Lock Status: Locked<br>MI Lost Status: Clean'
    );

    expect(result.miLockStatus).toBe('Locked');
    expect(result.miLostStatus).toBe('Clean');
    expect(result.status).toBe('Clean');
    expect(result.verdictType).toBe('caution');
    expect(result.verdict).toContain('Xiaomi account lock');
  });

  it('surfaces Xiaomi lost status as a danger verdict', () => {
    const result = parseSickwResponse({
      'Model Name': 'Redmi Note 13',
      'Mi Account Status': 'Unlocked',
      'Lost Mode': 'Lost',
    });

    expect(result.miLockStatus).toBe('Unlocked');
    expect(result.miLostStatus).toBe('Lost');
    expect(result.status).toBe('Blacklisted');
    expect(result.verdictType).toBe('danger');
  });

  it('extracts mdm status when provider returns management-lock fields', () => {
    const result = parseSickwResponse(
      'Model Name: iPhone 14 Pro<br>MDM Status: ON'
    );

    expect(result.device).toBe('iPhone 14 Pro');
    expect(result.mdmStatus).toBe('ON');
  });
});
