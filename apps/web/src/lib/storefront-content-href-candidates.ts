/**
 * Extracts candidate href/URL strings from raw blog content without needing
 * to know the format upfront: HTML `href=` attributes (quoted or legacy
 * unquoted), markdown inline links (incl. titles and angle-bracket
 * destinations), reference-style definitions, autolinks, and bare URLs that
 * GFM renders as anchors. Trailing sentence punctuation is trimmed so bare
 * URLs at the end of prose sentences resolve cleanly.
 */

// Matches href values in raw HTML (`href="..."`), TipTap JSON (`"href":"..."`)
// and markdown (`](...)`) without needing to know the content format upfront.
const HREF_ATTRIBUTE_REGEX = /\bhref\\?["']?\s*[:=]\s*\\?["']([^"'\\<>\s]+)/gi;
// Legacy/imported HTML can carry valid unquoted hrefs (<a href=/blog/x>).
const UNQUOTED_HREF_ATTRIBUTE_REGEX = /\bhref\s*=\s*([^"'\s<>=][^\s<>]*)/gi;
// Reference-style Markdown definitions ([label]: /blog/x or <...>), which
// `marked` renders as anchors just like inline links.
// Markdown autolinks (<https://ogabassey.com/blog/x>) render as anchors too.
const MARKDOWN_AUTOLINK_REGEX = /<(https?:\/\/[^<>\s]+)>/gi;
// Bare URLs in Markdown prose also render as anchors (GFM autolinking);
// trailing sentence punctuation is trimmed at collection time.
const MARKDOWN_BARE_URL_REGEX = /\b(https?:\/\/[^\s<>()"']+)/gi;
const MARKDOWN_REFERENCE_DEFINITION_REGEX =
  /^[ \t]*\[[^\]\n]+\]:[ \t]*(<[^<>\s]+>|\S+)/gm;
const MARKDOWN_LINK_REGEX =
  /\]\(\s*(<[^<>\s]+>|[^()\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

export function collectHrefCandidates(contentStr: string): string[] {
  const candidates: string[] = [];

  for (const regex of [
    HREF_ATTRIBUTE_REGEX,
    UNQUOTED_HREF_ATTRIBUTE_REGEX,
    MARKDOWN_LINK_REGEX,
    MARKDOWN_REFERENCE_DEFINITION_REGEX,
    MARKDOWN_AUTOLINK_REGEX,
    MARKDOWN_BARE_URL_REGEX,
  ]) {
    regex.lastIndex = 0;
    let match = regex.exec(contentStr);
    while (match !== null) {
      const captured = match[1];
      const unwrapped =
        captured.startsWith('<') && captured.endsWith('>')
          ? captured.slice(1, -1)
          : captured;
      // Bare URLs in prose often end at sentence punctuation.
      candidates.push(unwrapped.replace(/[.,;:!?]+$/, ''));
      match = regex.exec(contentStr);
    }
  }

  return candidates;
}
