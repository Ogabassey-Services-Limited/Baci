import { describe, expect, it } from 'vitest';
import { withHexAlpha } from './AdminFloatingTabBar.colors';

describe('withHexAlpha', () => {
  it('appends clamped alpha to six-digit hex colors', () => {
    expect(withHexAlpha('#000000', 0)).toBe('#00000000');
    expect(withHexAlpha('#ffffff', 1)).toBe('#ffffffff');
    expect(withHexAlpha('#336699', 0.32)).toBe('#33669952');
    expect(withHexAlpha('#336699', -1)).toBe('#33669900');
    expect(withHexAlpha('#336699', 2)).toBe('#336699ff');
  });

  it('leaves unsupported color values unchanged', () => {
    expect(withHexAlpha('rgba(0, 0, 0, 0.2)', 0.3)).toBe('rgba(0, 0, 0, 0.2)');
    expect(withHexAlpha('#fff', 0.3)).toBe('#fff');
    expect(withHexAlpha('#zzzzzz', 0.5)).toBe('#zzzzzz');
  });
});
