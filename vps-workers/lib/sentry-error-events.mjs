import { createHash } from 'node:crypto';

const boundedString = (value, length) =>
  typeof value === 'string' ? value.trim().slice(0, length) : '';

const positiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const nextPageFromLink = (linkHeader, currentUrl) => {
  if (!linkHeader) return null;

  for (const part of linkHeader.split(',')) {
    if (!/\brel="?next"?/i.test(part) || !/\bresults="?true"?/i.test(part)) {
      continue;
    }
    const match = part.match(/<([^>]+)>/);
    if (!match) continue;

    const nextUrl = new URL(match[1], currentUrl);
    if (
      nextUrl.origin !== currentUrl.origin ||
      nextUrl.pathname !== currentUrl.pathname
    ) {
      throw new Error('Sentry pagination returned an unsafe next-page URL');
    }
    return nextUrl;
  }

  return null;
};

const classifyIssueTitle = (value) => {
  const title = boundedString(value, 1_000);
  if (/application not responding|\banr\b/i.test(title)) {
    return 'Application Not Responding';
  }
  if (/native crash|fatal exception|signal \d+/i.test(title)) {
    return 'Native crash';
  }
  return 'Sentry mobile issue';
};

const classifyCulprit = (value) => {
  const culprit = boundedString(value, 240);
  if (/\bMainActivity\b/.test(culprit)) return 'MainActivity';
  if (/\bMainApplication\b/.test(culprit)) return 'MainApplication';
  if (/com\.ogabassey\.store/.test(culprit)) return 'com.ogabassey.store';
  return '(redacted native location)';
};

export async function fetchSentryRemediationCandidates({
  env = process.env,
  fetchFn = fetch,
} = {}) {
  const token = boundedString(env.SENTRY_REMEDIATION_AUTH_TOKEN, 2_000);
  const organization = boundedString(env.SENTRY_ORG, 120);
  const project = boundedString(env.SENTRY_PROJECT, 120);
  if (!token || !organization || !project) {
    throw new Error(
      'SENTRY_REMEDIATION_AUTH_TOKEN (with event:read), SENTRY_ORG, and SENTRY_PROJECT are required'
    );
  }

  const baseUrl = boundedString(env.SENTRY_URL, 500) || 'https://sentry.io/';
  const endpoint = new URL(
    `/api/0/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/issues/`,
    baseUrl
  );
  endpoint.searchParams.set('limit', '100');
  endpoint.searchParams.set('query', 'is:unresolved');
  endpoint.searchParams.set('sort', 'date');

  const maximumPages = Math.min(
    positiveInteger(env.BACI_SENTRY_REMEDIATION_MAX_PAGES, 10),
    50
  );
  const issues = [];
  let pageUrl = endpoint;
  for (let page = 0; page < maximumPages; page += 1) {
    const response = await fetchFn(pageUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const scopeHint =
        response.status === 401 || response.status === 403
          ? '; SENTRY_REMEDIATION_AUTH_TOKEN requires event:read'
          : '';
      throw new Error(
        `Sentry issues request failed with HTTP ${response.status}${scopeHint}`
      );
    }

    const pageIssues = await response.json();
    if (!Array.isArray(pageIssues)) {
      throw new Error('Sentry issues response was not an array');
    }
    issues.push(...pageIssues);

    const nextPage = nextPageFromLink(response.headers.get('link'), pageUrl);
    if (!nextPage) return selectCandidates(issues, env);
    pageUrl = nextPage;
  }

  throw new Error(
    `Sentry issue pagination exceeded ${maximumPages} pages; raise BACI_SENTRY_REMEDIATION_MAX_PAGES to avoid a measurement gap`
  );
}

const selectCandidates = (issues, env) => {
  const minimum = positiveInteger(env.BACI_REMEDIATION_MIN_OCCURRENCES, 2);
  return issues.flatMap((issue) => {
    const id = boundedString(issue?.id, 120);
    const occurrences = positiveInteger(issue?.count, 0);
    if (!id || occurrences < minimum) {
      return [];
    }

    return [
      {
        fingerprint: createHash('sha256')
          .update(`sentry:${id}`)
          .digest('hex')
          .slice(0, 16),
        firstSeen: boundedString(issue?.firstSeen, 80),
        lastSeen: boundedString(issue?.lastSeen, 80),
        occurrences,
        sample: {
          issueId: id,
          message: classifyIssueTitle(issue?.title),
          release: boundedString(issue?.lastRelease?.version, 120),
          route: classifyCulprit(issue?.culprit),
          source: 'sentry',
        },
      },
    ];
  });
};
