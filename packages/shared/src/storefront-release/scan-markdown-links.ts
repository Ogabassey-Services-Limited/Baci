import { scanMarkdownLinkSyntax } from './scan-markdown-link-syntax';
import { scanMarkdownReferenceDefinitions } from './scan-markdown-reference-definitions';

/** Parses Markdown links and reference definitions while preserving image context. */
export function scanMarkdownLinks(content: string) {
  return {
    ...scanMarkdownLinkSyntax(content),
    referenceDefinitions: scanMarkdownReferenceDefinitions(content),
  };
}
