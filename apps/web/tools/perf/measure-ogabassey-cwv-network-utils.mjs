import { DEBUGBEAR_USER_AGENT } from './measure-ogabassey-cwv-utils.mjs';

function redactUrlForError(value) {
  try {
    const url = new URL(value);
    const secretKeys = new Set(['api_key', 'key', 'token']);
    for (const [param] of url.searchParams.entries()) {
      if (secretKeys.has(param.toLowerCase())) {
        url.searchParams.set(param, 'REDACTED');
      }
    }
    return url.toString();
  } catch {
    return `${value}`.replace(
      /([?&](?:api_key|key|token)=)[^&\s]+/gi,
      '$1REDACTED'
    );
  }
}

export async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `${redactUrlForError(url)} failed with ${response.status}: ${text}`
    );
  }
  return text ? JSON.parse(text) : {};
}

function getPathSegments(pathname) {
  return pathname.split('/').filter(Boolean);
}

function isBlogArticlePathForIndex(pathname, blogIndexPathname) {
  const blogIndexSegments = getPathSegments(blogIndexPathname);
  const blogIndex = blogIndexSegments.indexOf('blog');
  if (blogIndex < 0) return false;

  const storefrontPrefix = blogIndexSegments.slice(0, blogIndex);
  const segments = getPathSegments(pathname);
  if (segments[0] === 'api') return false;

  if (
    storefrontPrefix.some((segment, index) => segments[index] !== segment) ||
    segments[storefrontPrefix.length] !== 'blog'
  ) {
    return false;
  }

  const slug = segments[storefrontPrefix.length + 1];
  if (!slug) return false;

  const nonArticleSegments = new Set([
    'api',
    'author',
    'category',
    'feed',
    'news-sitemap.xml',
    'page',
    'rss',
    'sitemap.xml',
    'tag',
  ]);
  return !nonArticleSegments.has(slug.toLowerCase());
}

export async function resolveLatestBlogPostUrl(blogUrl) {
  if (process.env.OGABASSEY_BLOG_POST_URL) {
    return process.env.OGABASSEY_BLOG_POST_URL;
  }

  try {
    const response = await fetch(blogUrl, {
      headers: { 'user-agent': DEBUGBEAR_USER_AGENT },
    });
    if (!response.ok) return null;

    const origin = new URL(blogUrl).origin;
    const html = await response.text();
    const matches = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(
      (match) => match[1]
    );
    for (const href of matches) {
      try {
        const url = new URL(href, blogUrl);
        if (
          url.origin === origin &&
          isBlogArticlePathForIndex(url.pathname, new URL(blogUrl).pathname)
        ) {
          url.hash = '';
          url.search = '';
          return url.toString();
        }
      } catch {
        // Skip malformed hrefs and keep scanning the blog index.
      }
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeUrlForStrictTarget(value) {
  const target = new URL(value);
  target.hash = '';
  target.search = '';
  if (target.pathname !== '/') {
    target.pathname = target.pathname.replace(/\/+$/, '');
  }
  return target;
}

function assertSamePdpTarget(candidate, requested, reason) {
  const candidateUrl = normalizeUrlForStrictTarget(candidate);
  const requestedUrl = normalizeUrlForStrictTarget(requested);

  if (candidateUrl.origin !== requestedUrl.origin) {
    throw new Error(
      `PDP canonical resolution changed origin from ${requestedUrl.origin} to ${candidateUrl.origin}`
    );
  }

  if (candidateUrl.pathname !== requestedUrl.pathname) {
    throw new Error(
      `PDP canonical resolution ${reason} changed path from ${requestedUrl.pathname} to ${candidateUrl.pathname}`
    );
  }

  return candidateUrl.toString();
}

export async function resolveCanonicalUrl(url) {
  const requested = normalizeUrlForStrictTarget(url).toString();

  const response = await fetch(requested, {
    headers: { 'user-agent': DEBUGBEAR_USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(
      `PDP canonical resolution failed for ${requested} with ${response.status}`
    );
  }

  const finalUrl = response.url ? response.url : requested;
  assertSamePdpTarget(finalUrl, requested, 'redirect');

  const html = await response.text();
  const canonicalTag = html.match(
    /<link\b[^>]*rel=["'][^"']*\bcanonical\b[^"']*["'][^>]*>/i
  )?.[0];
  const href = canonicalTag?.match(/\bhref=["']([^"']+)["']/i)?.[1];
  if (!href) return requested;

  return assertSamePdpTarget(
    new URL(href, requested).toString(),
    requested,
    'canonical'
  );
}
