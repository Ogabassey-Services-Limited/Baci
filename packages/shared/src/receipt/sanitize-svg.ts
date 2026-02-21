// Tag-pair patterns for dangerous SVG elements: match <tag...>content</tag...>.
// Uses [\s\S]*? (non-greedy) for content matching across lines.
// Closing tags use \b[^>]*> to handle whitespace, attributes, or garbage
// between tag name and > (e.g. </script >, </script/>).
const SVG_SCRIPT_RE = /<script\b[\s\S]*?<\/script\b[^>]*>/gi;
const SVG_STYLE_RE = /<style\b[\s\S]*?<\/style\b[^>]*>/gi;
const SVG_FOREIGN_RE = /<foreignObject\b[\s\S]*?<\/foreignObject\b[^>]*>/gi;
const SVG_IFRAME_RE = /<iframe\b[\s\S]*?<\/iframe\b[^>]*>/gi;
const SVG_OBJECT_RE = /<object\b[\s\S]*?<\/object\b[^>]*>/gi;
const SVG_EMBED_RE = /<embed\b[^>]*\/?>/gi;

/**
 * Sanitize SVG by stripping dangerous elements and attributes.
 * Removes: <script>, <style>, <foreignObject>, <iframe>, <embed>, <object> tags,
 * event handlers (on*), javascript: URIs, data: URIs, and
 * <use> elements with external references.
 */
export function sanitizeSvg(svg: string): string {
  // Iterative stripping to prevent nested-tag reconstruction bypasses
  // (e.g. <scr<script>ipt> becomes <script> after first pass)
  let result = svg;
  let prev = '';
  while (result !== prev) {
    prev = result;
    result = result
      // Remove dangerous tag pairs and their content
      .replace(SVG_SCRIPT_RE, '')
      .replace(SVG_STYLE_RE, '')
      .replace(SVG_FOREIGN_RE, '')
      .replace(SVG_IFRAME_RE, '')
      .replace(SVG_OBJECT_RE, '')
      .replace(SVG_EMBED_RE, '')
      // Hardening: catch any remaining orphaned opening/closing/self-closing tags
      .replace(
        /<\s*\/?\s*(?:script|style|iframe|foreignObject|object|embed)\b[^>]*>/gi,
        ''
      )
      // Final hardening: strip any residual starts of dangerous tags,
      // even if they are malformed or truncated (e.g. just "<script")
      .replace(/<\s*(?:script|style|iframe|foreignObject|object|embed)\b/gi, '')
      // Remove <use> elements with external references
      .replace(
        /<use[^>]*(?:href|xlink:href)\s*=\s*(?:"(?:https?:|\/\/)[^"]*"|'(?:https?:|\/\/)[^']*')[^>]*\/?>(?:<\/use>)?/gi,
        ''
      )
      // Remove all event handler attributes (on*)
      .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
      // Remove javascript: URIs in href/xlink:href
      .replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href=""')
      .replace(/href\s*=\s*'javascript:[^']*'/gi, "href=''")
      .replace(/xlink:href\s*=\s*"javascript:[^"]*"/gi, 'xlink:href=""')
      .replace(/xlink:href\s*=\s*'javascript:[^']*'/gi, "xlink:href=''")
      // Remove data: URIs (can embed scripts or external content)
      .replace(/href\s*=\s*"data:[^"]*"/gi, 'href=""')
      .replace(/href\s*=\s*'data:[^']*'/gi, "href=''")
      .replace(/xlink:href\s*=\s*"data:[^"]*"/gi, 'xlink:href=""')
      .replace(/xlink:href\s*=\s*'data:[^']*'/gi, "xlink:href=''")
      .replace(/src\s*=\s*"data:[^"]*"/gi, 'src=""')
      .replace(/src\s*=\s*'data:[^']*'/gi, "src=''");
  }

  // Post-loop absolute hardening: character-level scan that drops any "<"
  // introducing a dangerous tag name, avoiding one-shot multi-character
  // sanitization patterns that static analyzers flag as incomplete.
  const dangerous = [
    'script',
    'style',
    'iframe',
    'foreignobject',
    'object',
    'embed',
  ];
  const lower = result.toLowerCase();
  const outParts: string[] = [];
  let i = 0;
  while (i < result.length) {
    if (result[i] === '<') {
      let j = i + 1;
      while (j < lower.length && /\s/.test(lower[j])) j++;
      let matched = false;
      for (const name of dangerous) {
        if (lower.startsWith(name, j)) {
          const k = j + name.length;
          if (k >= lower.length || !/[a-z0-9-]/.test(lower[k])) {
            matched = true;
            break;
          }
        }
      }
      if (matched) {
        i++;
        continue;
      }
    }
    outParts.push(result[i]);
    i++;
  }

  return outParts.join('');
}
