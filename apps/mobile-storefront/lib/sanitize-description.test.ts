/**
 * Tests for the `sanitizeDescriptionPlainText` utility.
 *
 * Now that the function lives in its own module with zero native dependencies,
 * no module mocks are required.
 */

import { sanitizeDescriptionPlainText } from './sanitize-description';

describe('sanitizeDescriptionPlainText', () => {
  // -------------------------------------------------------------------------
  // Falsy / empty inputs
  // -------------------------------------------------------------------------
  describe('falsy input handling', () => {
    it('returns empty string for an empty string input', () => {
      // Arrange
      const input = '';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('');
    });

    it('returns empty string for null coerced as string (runtime falsy)', () => {
      // Arrange – the TypeScript signature says `string` but callers may pass
      // null at runtime (e.g. from a Supabase nullable column)
      const input = null as unknown as string;

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('');
    });

    it('returns empty string for undefined coerced as string (runtime falsy)', () => {
      // Arrange
      const input = undefined as unknown as string;

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Individual character escaping
  // -------------------------------------------------------------------------
  describe('HTML special character escaping', () => {
    it('escapes & to &amp;', () => {
      // Arrange
      const input = 'Tom & Jerry';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('Tom &amp; Jerry');
    });

    it('escapes < to &lt;', () => {
      // Arrange
      const input = '1 < 2';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('1 &lt; 2');
    });

    it('escapes > to &gt;', () => {
      // Arrange
      const input = '2 > 1';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('2 &gt; 1');
    });

    it('escapes " to &quot;', () => {
      // Arrange
      const input = 'Say "hello"';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('Say &quot;hello&quot;');
    });

    it("escapes ' to &#039;", () => {
      // Arrange
      const input = "it's fine";

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('it&#039;s fine');
    });
  });

  // -------------------------------------------------------------------------
  // Multiple characters in a single string
  // -------------------------------------------------------------------------
  describe('multiple special characters in one string', () => {
    it('escapes all occurrences of each special character', () => {
      // Arrange – three ampersands
      const input = 'a & b & c & d';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('a &amp; b &amp; c &amp; d');
    });

    it('escapes a mix of all five special characters', () => {
      // Arrange – a typical XSS-attempt string
      const input = '<script>alert("XSS & \'pwn\'");</script>';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe(
        '&lt;script&gt;alert(&quot;XSS &amp; &#039;pwn&#039;&quot;);&lt;/script&gt;'
      );
    });

    it('escapes angle brackets in an HTML tag-like string', () => {
      // Arrange
      const input = '<b>bold</b>';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('&lt;b&gt;bold&lt;/b&gt;');
    });
  });

  // -------------------------------------------------------------------------
  // Already-escaped input (double-escaping behaviour)
  // -------------------------------------------------------------------------
  describe('already-escaped input produces double-escaping', () => {
    it('double-escapes an existing &amp; entity because & is replaced first', () => {
      // Arrange – the & in &amp; gets replaced first, producing &amp;amp;
      const input = 'cats &amp; dogs';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('cats &amp;amp; dogs');
    });

    it('double-escapes &lt; to &amp;lt;', () => {
      // Arrange
      const input = '&lt;';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('&amp;lt;');
    });

    it('double-escapes &gt; to &amp;gt;', () => {
      // Arrange
      const input = '&gt;';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('&amp;gt;');
    });

    it('double-escapes &quot; to &amp;quot;', () => {
      // Arrange
      const input = '&quot;';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('&amp;quot;');
    });

    it('double-escapes &#039; to &amp;#039;', () => {
      // Arrange
      const input = '&#039;';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('&amp;#039;');
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('returns the same string when there are no special characters', () => {
      // Arrange
      const input = 'A perfectly safe product description.';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('A perfectly safe product description.');
    });

    it('handles a string that contains only special characters', () => {
      // Arrange
      const input = '&<>"\' ';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('&amp;&lt;&gt;&quot;&#039; ');
    });

    it('handles a very long string by escaping all special characters throughout', () => {
      // Arrange – 500 repetitions of '<>' produces a 1 000-character string
      const repeated = '<>'.repeat(500);

      // Act
      const result = sanitizeDescriptionPlainText(repeated);

      // Assert – each '<' → '&lt;' (4 chars), each '>' → '&gt;' (4 chars)
      const expected = '&lt;&gt;'.repeat(500);
      expect(result).toBe(expected);
    });

    it('preserves whitespace, newlines, and non-ASCII characters unchanged', () => {
      // Arrange – no HTML special chars present
      const input = '  Hello\nWörld\t!  ';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('  Hello\nWörld\t!  ');
    });

    it('handles a string with numbers and punctuation that require no escaping', () => {
      // Arrange
      const input = 'Price: 100.00 USD (tax included) — 2026 model.';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('Price: 100.00 USD (tax included) — 2026 model.');
    });

    it('handles a single special character', () => {
      // Arrange
      const input = '&';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('&amp;');
    });

    it('escapes & before < so the resulting &lt; is not double-escaped', () => {
      // Verify replacement order: & is replaced before <.
      // "&<" → after & pass: "&amp;<" → after < pass: "&amp;&lt;"
      const input = '&<';

      // Act
      const result = sanitizeDescriptionPlainText(input);

      // Assert
      expect(result).toBe('&amp;&lt;');
    });
  });
});
