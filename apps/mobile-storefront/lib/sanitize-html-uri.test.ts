import { stripUnsafeUriPrefix } from './sanitize-html-uri';

describe('stripUnsafeUriPrefix', () => {
  it('returns empty string for empty input', () => {
    expect(stripUnsafeUriPrefix('')).toBe('');
  });

  it('removes unsafe schemes', () => {
    expect(stripUnsafeUriPrefix('javascript:alert(1)')).toBe('alert(1)');
    expect(stripUnsafeUriPrefix('JavaScript:alert(1)')).toBe('alert(1)');
    expect(stripUnsafeUriPrefix('JAVASCRIPT:alert(1)')).toBe('alert(1)');
    expect(stripUnsafeUriPrefix('javascript:')).toBe('');
    expect(stripUnsafeUriPrefix('data:text/html,pwn')).toBe('text/html,pwn');
    expect(stripUnsafeUriPrefix('vbscript:msgbox(1)')).toBe('msgbox(1)');
    expect(stripUnsafeUriPrefix('blob:https://example.com/123')).toBe(
      'https://example.com/123'
    );
  });

  it('removes repeated unsafe prefixes until stable', () => {
    expect(stripUnsafeUriPrefix('javascript:javascript:alert(1)')).toBe(
      'alert(1)'
    );
    expect(stripUnsafeUriPrefix('javascript:data:x')).toBe('x');
    expect(stripUnsafeUriPrefix('javascript: data:x')).toBe('x');
  });

  it('handles many nested unsafe prefixes efficiently', () => {
    const nested = `${'javascript:'.repeat(30)}alert(1)`;
    expect(stripUnsafeUriPrefix(nested)).toBe('alert(1)');
  });

  it('ignores leading whitespace and control-character obfuscation', () => {
    expect(stripUnsafeUriPrefix('  \tjava\tscript:alert(1)')).toBe('alert(1)');
    expect(stripUnsafeUriPrefix('\ndata\n:text/html,pwn')).toBe(
      'text/html,pwn'
    );
    expect(stripUnsafeUriPrefix('java\x00script:alert(1)')).toBe('alert(1)');
    expect(stripUnsafeUriPrefix('java\x1Bscript:alert(1)')).toBe('alert(1)');
  });

  it('leaves safe schemes and relative paths unchanged', () => {
    expect(stripUnsafeUriPrefix('https://example.com')).toBe(
      'https://example.com'
    );
    expect(stripUnsafeUriPrefix('/products/item')).toBe('/products/item');
  });
});
