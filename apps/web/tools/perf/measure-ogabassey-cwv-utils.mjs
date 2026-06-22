export const DEBUGBEAR_USER_AGENT = 'Baci-CWV-measurement/1.0';

export const DEFAULT_OGABASSEY_CWV_TARGETS = Object.freeze({
  home: 'https://ogabassey.com/',
  pdp: 'https://ogabassey.com/gaming-laptops/dell-alienware-m18-r3-rtx-5080',
  blog: 'https://ogabassey.com/blog',
});

export function buildDebugBearHeaders(apiKey) {
  return {
    'content-type': 'application/json',
    'user-agent': DEBUGBEAR_USER_AGENT,
    'x-api-key': apiKey,
  };
}

export function normalizeDebugBearProjects(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.projects)) return body.projects;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body?.result)) return body.result;
  return [];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getProjectPages(project) {
  return [
    ...asArray(project?.pages),
    ...asArray(project?.pageList),
    ...asArray(project?.checks),
  ];
}

function getPageUrl(page) {
  return page?.url ?? page?.targetUrl ?? page?.pageUrl ?? page?.name ?? null;
}

function isMobilePage(page) {
  const text = [
    page?.device,
    page?.deviceName,
    page?.formFactor,
    page?.device?.formFactor,
    page?.device?.name,
    page?.testProfile?.device,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return !text || text.includes('mobile') || text.includes('phone');
}

export function normalizeUrlForMatch(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    if (url.pathname !== '/') {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    return url.toString();
  } catch {
    return '';
  }
}

function getOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

export function findDebugBearProjectIdForUrl(projects, targetUrl) {
  const target = normalizeUrlForMatch(targetUrl);
  const targetOrigin = getOrigin(targetUrl);

  for (const project of projects) {
    for (const page of getProjectPages(project)) {
      if (
        isMobilePage(page) &&
        normalizeUrlForMatch(getPageUrl(page)) === target
      ) {
        return project.id ?? project.projectId ?? null;
      }
    }
  }

  for (const project of projects) {
    for (const page of getProjectPages(project)) {
      if (isMobilePage(page) && getOrigin(getPageUrl(page)) === targetOrigin) {
        return project.id ?? project.projectId ?? null;
      }
    }
  }

  return null;
}

export function buildOgaBasseyCwvTargets({
  blogPostUrl,
  blogUrl = DEFAULT_OGABASSEY_CWV_TARGETS.blog,
  homeUrl = DEFAULT_OGABASSEY_CWV_TARGETS.home,
  pdpUrl = DEFAULT_OGABASSEY_CWV_TARGETS.pdp,
} = {}) {
  const targets = [
    { label: 'home', url: homeUrl },
    { label: 'pdp-dell', url: pdpUrl },
    { label: 'blog-index', url: blogUrl },
  ];

  if (blogPostUrl) {
    targets.push({ label: 'blog-post-latest', url: blogPostUrl });
  }

  return targets;
}
