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
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('Safe content');
    expect(result).toContain('More safe');
  });

  it('removes <iframe> tags', () => {
    const input =
      '<p>Text</p><iframe src="evil.com"><p>nested</p></iframe><span>End</span>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('evil.com');
    expect(result).toContain('Text');
    expect(result).toContain('End');
  });

  it('removes <object> tags', () => {
    const input =
      '<div>Start</div><object data="evil.swf"><param name="x"/></object><div>End</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<object');
    expect(result).toContain('Start');
    expect(result).toContain('End');
  });

  it('removes <embed> tags', () => {
    const input = '<p>Text</p><embed src="evil.swf" /><p>More</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<embed');
    expect(result).not.toContain('evil.swf');
    expect(result).toContain('Text');
    expect(result).toContain('More');
  });

  it('removes <form> and <input> tags', () => {
    const input =
      '<div>Safe</div><form action="/steal"><input type="text"/></form><div>End</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<input');
    expect(result).toContain('Safe');
    expect(result).toContain('End');
  });

  it('removes inline event handlers like onclick', () => {
    const input =
      '<button onclick="alert(1)">Click</button><div onload="steal()">Content</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('alert');
    expect(result).not.toContain('steal');
    expect(result).toContain('Click');
    expect(result).toContain('Content');
  });

  it('removes javascript: protocol URIs', () => {
    const input = '<a href="javascript:alert(1)">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('javascript:');
    expect(result).toContain('Link');
  });

  it('handles nested evasion attempts', () => {
    const input = '<scr<script>ipt>alert(1)</scr</script>ipt>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script');
  });

  it('preserves safe HTML elements and attributes', () => {
    const result = sanitizeHtml(
      '<p>Paragraph</p><div class="box">Content</div><span>Text</span><a href="/safe">Link</a>'
    );
    expect(result).toContain('Paragraph');
    expect(result).toContain('Content');
    expect(result).toContain('Text');
    expect(result).toContain('Link');
    expect(result).toContain('href="/safe"');
    expect(result).toContain('class="box"');
  });

  it('preserves safe img tags with src', () => {
    const result = sanitizeHtml('<img src="/photo.jpg" alt="A photo" />');
    expect(result).toContain('src="/photo.jpg"');
    expect(result).toContain('alt="A photo"');
  });

  it('handles combined attack vectors', () => {
    const input = `
      <div>Safe start</div>
      <script>alert("XSS1")</script>
      <p onclick="steal()">Click me</p>
      <a href="javascript:void(0)">Link</a>
      <iframe src="evil.com">Bad frame</iframe>
      <form><input type="password"/></form>
      <object data="flash.swf"></object>
      <embed src="plugin.swf"/>
      <div>Safe end</div>
    `.trim();

    const result = sanitizeHtml(input);

    expect(result).not.toContain('<script');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<input');
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');

    expect(result).toContain('Safe start');
    expect(result).toContain('Safe end');
    expect(result).toContain('Click me');
  });
});
