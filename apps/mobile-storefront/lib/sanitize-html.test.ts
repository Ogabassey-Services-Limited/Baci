import { sanitizeHtml } from './sanitize-html';

describe('sanitizeHtml', () => {
  it('returns empty string for falsy input', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null as unknown as string)).toBe('');
    expect(sanitizeHtml(undefined as unknown as string)).toBe('');
  });

  it('removes <script> tags with content', () => {
    const input =
      '<div>Safe content</div><script>alert("XSS")</script><p>More safe</p>';
    const expected = '<div>Safe content</div><p>More safe</p>';
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it('removes <style> tags with content', () => {
    const input =
      '<div>Safe</div><style>body { background: red } @import url("evil.css")</style><p>End</p>';
    const expected = '<div>Safe</div><p>End</p>';
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it('removes data: URIs from href and src attributes', () => {
    const input =
      '<a href="data:text/html,<script>alert(1)</script>">Link</a><img src="data:image/svg+xml,bad"/>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('data:');
  });

  it('removes unquoted data: URIs from href and src attributes', () => {
    const input =
      '<a href=data:text/html,<script>alert(1)</script>>Link</a><img src=data:image/svg+xml,bad/>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('data:');
  });

  it('removes <iframe> tags with content', () => {
    const input =
      '<p>Text</p><iframe src="evil.com"><p>nested</p></iframe><span>End</span>';
    const expected = '<p>Text</p><span>End</span>';
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it('removes <object> tags with content', () => {
    const input =
      '<div>Start</div><object data="evil.swf"><param name="x"/></object><div>End</div>';
    const expected = '<div>Start</div><div>End</div>';
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it('removes <embed> self-closing tags', () => {
    const input = '<p>Text</p><embed src="evil.swf" /><p>More</p>';
    const expected = '<p>Text</p><p>More</p>';
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it('removes self-closing dangerous tags without whitespace before />', () => {
    const input = '<p>Text</p><embed/><input/><p>More</p>';
    const expected = '<p>Text</p><p>More</p>';
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it('removes <form> tags with content', () => {
    const input =
      '<div>Safe</div><form action="/steal"><input type="text"/></form><div>End</div>';
    const expected = '<div>Safe</div><div>End</div>';
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it('removes <input> self-closing tags', () => {
    const input =
      '<div>Text</div><input type="password" name="pw"/><span>End</span>';
    const expected = '<div>Text</div><span>End</span>';
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it('removes inline event handlers like onclick', () => {
    const input =
      '<button onclick="alert(1)">Click</button><div onload="steal()">Content</div>';
    const expected = '<button>Click</button><div>Content</div>';
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it('removes javascript: protocol URIs', () => {
    const input =
      '<a href="javascript:alert(1)">Link</a><img src="javascript:void(0)"/>';
    const expected = '<a href="alert(1)">Link</a><img src="void(0)"/>';
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it('removes repeated unsafe URI prefixes', () => {
    const input = '<a href="javascript:javascript:alert(1)">Link</a>';
    const expected = '<a href="alert(1)">Link</a>';
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it('sanitizes xlink:href and formaction URI attributes', () => {
    const input =
      '<svg><a xlink:href="javascript:alert(1)">X</a></svg><button formaction="data:text/html,pwn">Submit</button>';
    const result = sanitizeHtml(input);
    expect(result).toContain('xlink:href="alert(1)"');
    expect(result).toContain('formaction="text/html,pwn"');
  });

  it('handles iterative stripping for nested evasion', () => {
    // Nested reconstruction payloads should not survive as executable tags.
    const input = '<scr<script>ipt>alert(1)</scr</script>ipt>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('</script');
  });

  it('handles closing tags with whitespace', () => {
    const input = '<script>alert(1)</script ><iframe>bad</iframe   >';
    const expected = '';
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it('handles non-space whitespace between < and dangerous tag names', () => {
    const input =
      '<\tscript>alert(1)</script><\nstyle>body{display:none}</style><p>Safe</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('<style');
    expect(result).toContain('<p>Safe</p>');
  });

  it('preserves safe HTML elements', () => {
    const input =
      '<p>Paragraph</p><div class="box">Content</div><span style="color:red">Text</span><a href="/safe">Link</a><img src="/img.png" alt="Safe"/>';
    // Safe elements are not removed
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('does not treat tag-name prefixes as dangerous tags', () => {
    const input =
      '<embedded-player>Safe component</embedded-player><formatting>Safe tag</formatting>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('handles combined complex case with multiple attack vectors', () => {
    const input = `
      <div>Safe start</div>
      <script>alert("XSS1")</script>
      <style>body { display: none }</style>
      <p onclick="steal()">Click me</p>
      <a href="javascript:void(0)">Link</a>
      <iframe src="evil.com">Bad frame</iframe>
      <form><input type="password"/></form>
      <object data="flash.swf"></object>
      <embed src="plugin.swf"/>
      <scr<script>ipt>nested</script>
      <div>Safe end</div>
    `.trim();

    const result = sanitizeHtml(input);

    // Verify all dangerous elements are removed
    expect(result).not.toContain('<script');
    expect(result).not.toContain('<style');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<input');
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');

    // Verify safe content is preserved
    expect(result).toContain('<div>Safe start</div>');
    expect(result).toContain('<div>Safe end</div>');
    expect(result).toContain('<p>Click me</p>');
    expect(result).toContain('<a href="void(0)">Link</a>');
  });
});
