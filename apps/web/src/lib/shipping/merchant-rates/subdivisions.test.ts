import { describe, expect, it } from 'vitest';
import { getSubdivisions, resolveSubdivisionCode } from './subdivisions';

describe('getSubdivisions', () => {
  it('returns all 37 Nigerian subdivisions (36 states + FCT)', () => {
    const subdivisions = getSubdivisions('NG');

    expect(subdivisions).toHaveLength(37);
    expect(subdivisions).toContainEqual({ code: 'NG-LA', name: 'Lagos' });
    expect(subdivisions.some((s) => s.code === 'NG-FC')).toBe(true);
  });

  it('returns India states and union territories', () => {
    const subdivisions = getSubdivisions('IN');

    expect(subdivisions).toHaveLength(36);
    expect(subdivisions.some((s) => s.code === 'IN-MH')).toBe(true);
  });

  it('returns the 7 UAE emirates', () => {
    expect(getSubdivisions('AE')).toHaveLength(7);
  });

  it('is case-insensitive on the country code', () => {
    expect(getSubdivisions('ng')).toHaveLength(37);
  });

  it('returns an empty array for country-level-only countries', () => {
    expect(getSubdivisions('GB')).toEqual([]);
  });
});

describe('resolveSubdivisionCode', () => {
  it('resolves an exact Nigerian state name', () => {
    expect(resolveSubdivisionCode('NG', 'Lagos')).toBe('NG-LA');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(resolveSubdivisionCode('NG', 'lagos ')).toBe('NG-LA');
    expect(resolveSubdivisionCode('NG', '  LAGOS')).toBe('NG-LA');
  });

  it('resolves FCT aliases (FCT / Abuja / FCT - Abuja) to NG-FC', () => {
    expect(resolveSubdivisionCode('NG', 'FCT')).toBe('NG-FC');
    expect(resolveSubdivisionCode('NG', 'Abuja')).toBe('NG-FC');
    expect(resolveSubdivisionCode('NG', 'FCT - Abuja')).toBe('NG-FC');
    expect(resolveSubdivisionCode('NG', 'Federal Capital Territory')).toBe(
      'NG-FC'
    );
  });

  it('resolves alternate state spellings (Nassarawa)', () => {
    expect(resolveSubdivisionCode('NG', 'Nassarawa')).toBe('NG-NA');
  });

  it('strips a trailing generic "State" suffix before matching', () => {
    // A saved/free-form address of "Lagos State" must still resolve to NG-LA so
    // a Lagos-specific zone wins over the country/rest-of-world fallback.
    expect(resolveSubdivisionCode('NG', 'Lagos State')).toBe('NG-LA');
    expect(resolveSubdivisionCode('NG', 'lagos state ')).toBe('NG-LA');
  });

  it('strips generic province/region suffixes too', () => {
    expect(resolveSubdivisionCode('NG', 'Kano Province')).toBe('NG-KN');
    expect(resolveSubdivisionCode('NG', 'Kano region')).toBe('NG-KN');
  });

  it('resolves an India state name carrying a "State" suffix', () => {
    expect(resolveSubdivisionCode('IN', 'Maharashtra State')).toBe('IN-MH');
  });

  it('still resolves multi-word aliases that are not generic suffixes', () => {
    // Guard against over-eager stripping: "FCT - Abuja" must keep resolving.
    expect(resolveSubdivisionCode('NG', 'FCT - Abuja')).toBe('NG-FC');
    expect(resolveSubdivisionCode('IN', 'West Bengal')).toBe('IN-WB');
  });

  it('returns null for an unknown state even with a stripped suffix', () => {
    expect(resolveSubdivisionCode('NG', 'Atlantis State')).toBeNull();
  });

  it('accepts an already-resolved ISO code', () => {
    expect(resolveSubdivisionCode('NG', 'NG-LA')).toBe('NG-LA');
  });

  it('resolves India names and old aliases', () => {
    expect(resolveSubdivisionCode('IN', 'Odisha')).toBe('IN-OD');
    expect(resolveSubdivisionCode('IN', 'Orissa')).toBe('IN-OD');
  });

  it('resolves UAE emirate names', () => {
    expect(resolveSubdivisionCode('AE', 'Dubai')).toBe('AE-DU');
  });

  it('returns null for an unknown state name', () => {
    expect(resolveSubdivisionCode('NG', 'Atlantis')).toBeNull();
  });

  it('returns null for an unknown country', () => {
    expect(resolveSubdivisionCode('GB', 'London')).toBeNull();
  });

  it('returns null for empty or missing input', () => {
    expect(resolveSubdivisionCode('NG', '')).toBeNull();
    expect(resolveSubdivisionCode('NG', null)).toBeNull();
    expect(resolveSubdivisionCode('NG', undefined)).toBeNull();
  });
});
