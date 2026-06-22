export const DEBUGBEAR_USER_AGENT = 'Baci-CWV-measurement/1.0';

export const DEFAULT_OGABASSEY_CWV_TARGETS = Object.freeze({
  home: 'https://ogabassey.com/',
  pdp: 'https://ogabassey.com/gaming-laptops/dell-alienware-m18-r3-rtx-5080',
  blog: 'https://ogabassey.com/blog',
});

export async function loadEnvFile(path, { env = process.env, readText } = {}) {
  const reader = readText ?? (await import('node:fs/promises')).readFile;
  let text = '';
  try {
    text = await reader(path, 'utf8');
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return false;
    }
    throw error;
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const raw = trimmed.slice(index + 1).trim();
    if (!key || env[key] !== undefined) continue;
    env[key] = raw.replace(/^["']|["']$/g, '');
  }
  return true;
}

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

function pageMatchesDevice(page, requestedDevice) {
  const text = [
    page?.deviceName,
    page?.formFactor,
    page?.device?.formFactor,
    page?.device?.name,
    page?.testProfile?.device,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!text) return true;

  const requested = `${requestedDevice || ''}`.toLowerCase();
  if (requested.includes('desktop')) {
    return text.includes('desktop');
  }
  if (requested.includes('mobile') || requested.includes('phone')) {
    return text.includes('mobile') || text.includes('phone');
  }
  return text.includes(requested);
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

export function findDebugBearProjectIdForUrl(
  projects,
  targetUrl,
  { deviceName = 'Mobile' } = {}
) {
  const target = normalizeUrlForMatch(targetUrl);
  const targetOrigin = getOrigin(targetUrl);
  if (!target || !targetOrigin) return null;

  for (const project of projects) {
    for (const page of getProjectPages(project)) {
      if (
        pageMatchesDevice(page, deviceName) &&
        normalizeUrlForMatch(getPageUrl(page)) === target
      ) {
        const projectId = project.id ?? project.projectId;
        if (projectId != null) return projectId;
      }
    }
  }

  for (const project of projects) {
    for (const page of getProjectPages(project)) {
      if (
        pageMatchesDevice(page, deviceName) &&
        getOrigin(getPageUrl(page)) === targetOrigin
      ) {
        const projectId = project.id ?? project.projectId;
        if (projectId != null) return projectId;
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
