import { describe, expect, it } from 'vitest';
import {
  MAX_MARKDOWN_TEXT_LENGTH,
  sanitizeMarkdownText,
} from '@/lib/llms-markdown-sanitize';

describe('sanitizeMarkdownText', () => {
  it('strips HTML and escapes markdown control characters', () => {
    const result = sanitizeMarkdownText(
      '<script>alert(1)</script>Bad [Store](javascript:alert(1)) **unsafe**'
    );

    expect(result).not.toContain('<script');
    expect(result).not.toContain('[Store](javascript');
    expect(result).not.toContain('**unsafe**');
    expect(result).not.toContain('javascript:');
    expect(result).toContain('Store');
    expect(result).toContain('unsafe');
  });

  it('returns an empty string for nullish values', () => {
    expect(sanitizeMarkdownText(null)).toBe('');
    expect(sanitizeMarkdownText(undefined)).toBe('');
  });

  it('returns an empty string for empty input', () => {
    expect(sanitizeMarkdownText('')).toBe('');
  });

  it('escapes markdown list and strikethrough controls', () => {
    const result = sanitizeMarkdownText('Hello **world** - ~sale~');

    expect(result).toBe('Hello \\*\\*world\\*\\* \\- \\~sale\\~');
  });

  it('removes HTML-like control sequences before markdown escaping', () => {
    expect(sanitizeMarkdownText('1 < 2 > 0')).toBe('1 0');
  });

  it('collapses excessive whitespace', () => {
    expect(sanitizeMarkdownText('One\n\n  two\tthree')).toBe('One two three');
  });

  it('stringifies non-string inputs before sanitizing', () => {
    expect(sanitizeMarkdownText(123)).toBe('123');
    expect(sanitizeMarkdownText({ label: 'Store' })).toBe(
      '\\[object Object\\]'
    );
  });

  it('neutralizes unsafe markdown link schemes', () => {
    const result = sanitizeMarkdownText(
      '[Bad](javascript:alert(1)) [Data](data:text/html) [VB](vbscript:msgbox(1))'
    ).toLowerCase();

    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('data:');
    expect(result).not.toContain('vbscript:');
    expect(result).toContain('blocked');
  });

  it('handles long inputs without dropping safe text', () => {
    const result = sanitizeMarkdownText(`${'safe '.repeat(3000)}**end**`);

    expect(result).toHaveLength(MAX_MARKDOWN_TEXT_LENGTH);
    expect(result).toContain('safe');
  });
});
