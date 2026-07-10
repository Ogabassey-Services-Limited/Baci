import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StorefrontSpeculationRules } from './storefront-speculation-rules';

function readSpeculationScript(container: HTMLElement): {
  raw: string;
  json: { prerender: unknown[]; prefetch: unknown[] };
} {
  const script = container.querySelector(
    'script[type="speculationrules"]'
  ) as HTMLScriptElement | null;
  if (!script) {
    throw new Error('speculationrules script not rendered');
  }
  const raw = script.textContent ?? '';
  return { raw, json: JSON.parse(raw) };
}

describe('StorefrontSpeculationRules', () => {
  it('emits a speculationrules script with prerender and prefetch rules', () => {
    // Arrange & Act
    const { container } = render(<StorefrontSpeculationRules basePath="" />);
    const { json } = readSpeculationScript(container);

    // Assert
    expect(Array.isArray(json.prerender)).toBe(true);
    expect(Array.isArray(json.prefetch)).toBe(true);
    expect(json.prerender).toHaveLength(1);
    expect(json.prefetch).toHaveLength(1);
  });

  it('serializes safely so the JSON cannot break out of the script element', () => {
    // Arrange & Act
    const { container } = render(<StorefrontSpeculationRules basePath="" />);
    const { raw, json } = readSpeculationScript(container);

    // Assert — no literal "</script>" or unescaped "<" in the emitted text,
    // yet it still round-trips through JSON.parse.
    expect(raw).not.toContain('</script>');
    expect(raw).not.toContain('<');
    expect(json.prerender).toHaveLength(1);
  });

  it('scopes patterns to the routing base path', () => {
    // Arrange & Act
    const { container } = render(
      <StorefrontSpeculationRules basePath="/ogabassey" />
    );
    const { raw } = readSpeculationScript(container);

    // Assert
    expect(raw).toContain('/ogabassey/:category/:product');
    expect(raw).toContain('/ogabassey/:category');
  });
});
