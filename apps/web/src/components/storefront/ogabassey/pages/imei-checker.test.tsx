import { describe, expect, it } from 'vitest';
import { OgabasseyImeiChecker } from './imei-checker';

describe('OgabasseyImeiChecker', () => {
  it('exports a valid component', () => {
    expect(OgabasseyImeiChecker).toBeDefined();
    expect(typeof OgabasseyImeiChecker).toBe('function');
  });
});
