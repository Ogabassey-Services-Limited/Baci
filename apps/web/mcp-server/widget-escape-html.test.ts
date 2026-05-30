import { describe, expect, it } from 'vitest';
import { escapeWidgetHtml, widgetEscapeHtmlScript } from './widget-escape-html';

describe('escapeWidgetHtml', () => {
  it('escapes HTML text and attribute metacharacters', () => {
    expect(escapeWidgetHtml(`" onerror="alert(1)' & <img>`)).toBe(
      '&quot; onerror=&quot;alert(1)&#039; &amp; &lt;img&gt;'
    );
  });

  it('preserves non-empty falsy values', () => {
    expect(escapeWidgetHtml(0)).toBe('0');
    expect(escapeWidgetHtml(false)).toBe('false');
    expect(escapeWidgetHtml('')).toBe('');
  });

  it('emits browser script with the same escaping behavior', () => {
    const runEscapeHtml = new Function(
      'value',
      `${widgetEscapeHtmlScript}; return escapeHtml(value);`
    ) as (value: unknown) => string;

    expect(runEscapeHtml(`https://example.test/a" onerror="alert(1)`)).toBe(
      'https://example.test/a&quot; onerror=&quot;alert(1)'
    );
  });
});
