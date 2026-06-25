import { describe, expect, it } from 'vitest';
import { OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS } from './ogabassey-internal-link-equity';

describe('OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS', () => {
  it('keeps the Semrush one-internal-link remediation list deduplicated and route-local', () => {
    const links = OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS.flatMap(
      (group) => group.links
    );
    const hrefs = links.map((link) => link.href);

    expect(links).toHaveLength(88);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((href) => href.startsWith('/'))).toBe(true);
    expect(hrefs.some((href) => href.startsWith('http'))).toBe(false);
  });
});
