const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

function getTimeoutMs() {
  const value = Number(process.env.OGABASSEY_CSS_BUDGET_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_FETCH_TIMEOUT_MS;
}

function toAbsoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, init = {}) {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(getTimeoutMs()),
    });
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      throw new Error(`fetchCssBudget timed out fetching ${url}`);
    }
    throw error;
  }
}

export function extractStylesheetUrls(html, baseUrl) {
  // This lightweight perf tool deliberately uses regex over a full HTML parser;
  // malformed edge cases are ignored and URL resolution is centralized in toAbsoluteUrl.
  return [...html.matchAll(/<link\s+[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => /\srel=["'][^"']*\bstylesheet\b[^"']*["']/i.test(tag))
    .map((tag) => tag.match(/\shref=["']([^"']+)["']/i)?.[1])
    .filter(Boolean)
    .map((href) => toAbsoluteUrl(href, baseUrl))
    .filter(Boolean);
}

export async function fetchCssBudget(url, limits) {
  const htmlResponse = await fetchWithTimeout(url, { redirect: 'follow' });
  if (!htmlResponse.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${htmlResponse.status} ${htmlResponse.statusText}`
    );
  }
  const html = await htmlResponse.text();
  const stylesheets = extractStylesheetUrls(html, url);
  const css = await Promise.all(
    stylesheets.map(async (href) => {
      const response = await fetchWithTimeout(href);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch CSS ${href}: ${response.status} ${response.statusText}`
        );
      }
      const body = await response.arrayBuffer();
      return {
        href,
        rawBytes: body.byteLength,
        declaredBytes:
          Number(response.headers.get('content-length')) || body.byteLength,
      };
    })
  );

  const largestRawBytes = Math.max(0, ...css.map((item) => item.rawBytes));
  const totalRawBytes = css.reduce((total, item) => total + item.rawBytes, 0);
  const totalDeclaredBytes = css.reduce(
    (total, item) => total + item.declaredBytes,
    0
  );

  return {
    css,
    largestRawBytes,
    passed:
      largestRawBytes <= limits.maxSingleRawBytes &&
      totalRawBytes <= limits.maxTotalRawBytes,
    totalDeclaredBytes,
    totalRawBytes,
    url,
  };
}

const routeBudgets = [
  {
    enforce: false,
    label: 'home',
    limits: {
      maxSingleRawBytes: 150000,
      maxTotalRawBytes: 350000,
    },
    url: process.env.OGABASSEY_HOME_URL || 'https://ogabassey.com/',
  },
  {
    enforce: true,
    label: 'pdp',
    limits: {
      maxSingleRawBytes: 75000,
      maxTotalRawBytes: 110000,
    },
    url:
      process.env.OGABASSEY_PDP_URL ||
      'https://ogabassey.com/laptops/dell-alienware-m18-r3-rtx-5080',
  },
];

if (import.meta.url === `file://${process.argv[1]}`) {
  const results = [];
  for (const route of routeBudgets) {
    const result = await fetchCssBudget(route.url, route.limits);
    results.push({
      enforce: route.enforce,
      label: route.label,
      ...result,
      limits: route.limits,
    });
  }

  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((result) => result.enforce && !result.passed);
  if (failed.length > 0) {
    throw new Error(
      `OgaBassey CSS budget failed for ${failed
        .map((result) => result.label)
        .join(', ')}`
    );
  }
}
