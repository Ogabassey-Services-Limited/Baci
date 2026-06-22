import { DEBUGBEAR_USER_AGENT } from './measure-ogabassey-cwv-utils.mjs';

export async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
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
          /^\/blog\/[^/?#]+/.test(url.pathname) &&
          !url.pathname.includes('/page/') &&
          !url.pathname.includes('/author/')
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
