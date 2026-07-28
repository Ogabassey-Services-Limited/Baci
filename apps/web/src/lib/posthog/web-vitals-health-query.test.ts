import { describe, expect, it } from 'vitest';
import { isPublicBlogPathname } from '@/lib/posthog/public-blog-path';
import {
  BLOG_FIRST_SEGMENT_PATTERN,
  BLOG_TENANT_SEGMENT_PATTERN,
  RESERVED_FIRST_SEGMENT_PATTERN,
  WEB_VITALS_HEALTH_QUERY,
} from '@/lib/posthog/web-vitals-health-query';

function hogqlClassifiesPathnameAsBlog(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return (
    new RegExp(BLOG_FIRST_SEGMENT_PATTERN).test(normalized) ||
    (new RegExp(BLOG_TENANT_SEGMENT_PATTERN).test(normalized) &&
      !new RegExp(RESERVED_FIRST_SEGMENT_PATTERN).test(normalized))
  );
}

describe('WEB_VITALS_HEALTH_QUERY', () => {
  it('uses only binary greatest calls so PostHog accepts the numerator', () => {
    const executableSql = WEB_VITALS_HEALTH_QUERY.split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');

    expect(executableSql).not.toMatch(/count\(DISTINCT/i);
    expect(executableSql.includes('$pageview_id')).toBe(false);
    expect(executableSql).toContain('AS vitals_pageviews');
    expect(executableSql).toContain(
      `greatest(
    greatest(
      countIf(event = 'web_vitals' AND properties.metric = 'LCP'),
      countIf(event = 'web_vitals' AND properties.metric = 'FCP')
    ),
    greatest(
      countIf(event = 'web_vitals' AND properties.metric = 'TTFB'),
      greatest(
        countIf(event = 'web_vitals' AND properties.metric = 'CLS'),
        countIf(event = 'web_vitals' AND properties.metric = 'INP')
      )
    )
  ) AS vitals_pageviews`
    );
  });

  it('restricts the denominator to initial document pageviews', () => {
    const executableSql = WEB_VITALS_HEALTH_QUERY.split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');

    expect(executableSql).toContain(
      "event = '$pageview'\n    AND properties.$prev_pageview_pathname IS NULL"
    );
  });

  it('matches blog surfaces by path segment, not a naive substring', () => {
    expect(WEB_VITALS_HEALTH_QUERY).not.toContain("LIKE '%/blog%'");
    expect(WEB_VITALS_HEALTH_QUERY).toContain(BLOG_FIRST_SEGMENT_PATTERN);
    expect(WEB_VITALS_HEALTH_QUERY).toContain(BLOG_TENANT_SEGMENT_PATTERN);
    expect(WEB_VITALS_HEALTH_QUERY).toContain(RESERVED_FIRST_SEGMENT_PATTERN);
  });
});

describe('non_blog_pageviews blog-surface parity', () => {
  it('excludes real blog surfaces from the denominator', () => {
    for (const pathname of ['/blog', '/blog/', '/blog/some-post']) {
      expect(hogqlClassifiesPathnameAsBlog(pathname)).toBe(true);
    }
  });

  it('counts blog-ish non-blog paths that the client never drops', () => {
    const eligiblePaths = [
      '/',
      '/dashboard/blog-settings',
      '/products/blogger-bag',
      '/dashboard/blog',
      '/admin/blog',
      '/ogabassey/products',
    ];

    for (const pathname of eligiblePaths) {
      expect(hogqlClassifiesPathnameAsBlog(pathname)).toBe(false);
    }
  });

  it('agrees with the client matcher on platform-host inputs', () => {
    const cases: Array<{ pathname: string; blog: boolean }> = [
      { pathname: '/blog/some-post', blog: true },
      { pathname: '/ogabassey/blog', blog: true },
      { pathname: '/ogabassey/blog/post-1', blog: true },
      { pathname: '/dashboard/blog-settings', blog: false },
      { pathname: '/products/blogger-bag', blog: false },
      { pathname: '/dashboard/blog', blog: false },
      { pathname: '/ogabassey/products', blog: false },
    ];

    for (const { pathname, blog } of cases) {
      expect(hogqlClassifiesPathnameAsBlog(pathname)).toBe(blog);
      expect(isPublicBlogPathname(pathname, { hostname: 'usebaci.com' })).toBe(
        blog
      );
    }
  });

  it('documents the intentional host-gating approximation', () => {
    expect(hogqlClassifiesPathnameAsBlog('/ogabassey/blog')).toBe(true);
    expect(
      isPublicBlogPathname('/ogabassey/blog', { hostname: 'ogabassey.com' })
    ).toBe(false);
  });
});
