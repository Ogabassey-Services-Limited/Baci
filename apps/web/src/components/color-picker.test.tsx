import { describe, expect, it } from 'vitest';
import { ColorPicker } from './color-picker';

describe('ColorPicker', () => {
  it('exports a valid component', () => {
    expect(ColorPicker).toBeDefined();
    expect(typeof ColorPicker).toBe('function');
  });
});
