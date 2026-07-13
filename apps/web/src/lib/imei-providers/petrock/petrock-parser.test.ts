import { describe, expect, it } from 'vitest';
import { parsePetrockReplay } from './petrock-parser';

describe('parsePetrockReplay', () => {
  it('parses font and span color markup plus Petrock label aliases', () => {
    const result = parsePetrockReplay(
      [
        'Model Description: iPhone 17 Pro Max (A3525)',
        'USA Blacklist: <font color="#008000">Clean</font>',
        'SIMLock: <span style="color: #ff0000">Locked</span>',
        'Locked Carrier: US AT&T',
      ].join('<br>')
    );

    expect(result).toMatchObject({
      blacklistStatus: 'Clean',
      carrier: 'US AT&T',
      device: 'iPhone 17 Pro Max (A3525)',
      simLock: 'Locked',
      status: 'Clean',
      verdictType: 'caution',
    });
  });

  it('treats a lost-or-stolen carrier result as blacklisted', () => {
    const result = parsePetrockReplay(
      'Model: iPhone 15<br>AT&T ESN: <font color="#FF0000">Lost or Stolen</font>'
    );

    expect(result.blacklistStatus).toBe('Lost or Stolen');
    expect(result.status).toBe('Blacklisted');
    expect(result.verdictType).toBe('danger');
  });

  it('maps the six Phase 3 Petrock result aliases without making a dark tier public', () => {
    const result = parsePetrockReplay(
      [
        'Model: Samsung Galaxy S25',
        'eSIM Support: Yes',
        'Finance: Past Due',
        'KME Status: Enrolled',
        'Sold To: Example Retailer',
        'Wi-Fi MAC Address: A1:B2:C3:D4:E5:F6',
        'Photo URL: https://cdn.example.com/device.jpg',
      ].join('<br>')
    );

    expect(result).toMatchObject({
      devicePhoto: 'https://cdn.example.com/device.jpg',
      esimCompatibility: 'Yes',
      financeStatus: 'Past Due',
      knoxEnrollment: 'Enrolled',
      soldBy: 'Example Retailer',
      wifiMac: 'A1:B2:C3:D4:E5:F6',
    });
  });

  it('does not call an unrecognized replay clean', () => {
    const result = parsePetrockReplay('Unrecognized Vendor Field: Value');

    expect(result.status).toBe('Unknown');
    expect(result.verdictType).toBe('caution');
  });
});
