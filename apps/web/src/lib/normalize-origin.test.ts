import { describe, expect, it } from 'vitest';
import { normalizeOrigin } from '@/lib/normalize-origin';

describe('normalizeOrigin', () => {
  it('preserves origins without trailing slashes', () => {
    expect(normalizeOrigin('https://usebaci.com')).toBe('https://usebaci.com');
  });

  it('removes one or more trailing slashes', () => {
    expect(normalizeOrigin('https://usebaci.com/')).toBe('https://usebaci.com');
    expect(normalizeOrigin('https://usebaci.com///')).toBe(
      'https://usebaci.com'
    );
  });

  it('handles empty and slash-only inputs', () => {
    expect(normalizeOrigin('')).toBe('');
    expect(normalizeOrigin('/')).toBe('');
    expect(normalizeOrigin('//')).toBe('');
  });

  it('preserves ports and non-https protocols', () => {
    expect(normalizeOrigin('https://localhost:3000/')).toBe(
      'https://localhost:3000'
    );
    expect(normalizeOrigin('http://usebaci.com/')).toBe('http://usebaci.com');
  });

  it('trims trailing slashes from base URLs with paths', () => {
    expect(normalizeOrigin('https://usebaci.com/path/')).toBe(
      'https://usebaci.com/path'
    );
  });
});
