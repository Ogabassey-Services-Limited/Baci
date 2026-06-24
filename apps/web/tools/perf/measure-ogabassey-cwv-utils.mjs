export const DEBUGBEAR_USER_AGENT = 'Baci-CWV-measurement/1.0';

export const DEFAULT_OGABASSEY_CWV_TARGETS = Object.freeze({
  home: 'https://ogabassey.com/',
  pdp: 'https://ogabassey.com/gaming-laptops/dell-alienware-m18-r3-rtx-5080',
  blog: 'https://ogabassey.com/blog',
});

export async function loadEnvFile(
  path,
  { env = process.env, override = false, readText } = {}
) {
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
    const shouldOverride =
      typeof override === 'function' ? override(key, env[key]) : override;
    if (!key || (!shouldOverride && env[key] !== undefined)) continue;
    env[key] = raw.replace(/^["']|["']$/g, '');
  }
  return true;
}

export function normalizeEnvFlag(value) {
  return `${value ?? ''}`.trim().toLowerCase();
}

export function isTruthyEnvValue(value) {
  return ['1', 'true', 'yes', 'on'].includes(normalizeEnvFlag(value));
}

export function isFalseyEnvValue(value) {
  return ['0', 'false', 'no', 'off'].includes(normalizeEnvFlag(value));
}

export function setDefaultEnv(env, key, value) {
  if (`${env[key] ?? ''}`.trim()) return;
  env[key] = value;
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

function normalizeTargetLabel(value) {
  const normalized = `${value ?? ''}`.trim().toLowerCase();
  if (normalized === 'pdp' || normalized === 'pdp-lcp') return 'pdp-dell';
  if (normalized === 'blog') return 'blog-index';
  if (normalized === 'latest-blog-post') return 'blog-post-latest';
  return normalized;
}

export function filterOgaBasseyCwvTargets(targets, requestedLabels) {
  const labels = `${requestedLabels ?? ''}`
    .split(',')
    .map(normalizeTargetLabel)
    .filter(Boolean);
  if (!labels.length) return targets;

  const labelSet = new Set(labels);
  return targets.filter((target) => labelSet.has(target.label));
}

export function buildOgaBasseyCwvConfigurationFailures({
  debugBearApiKey,
  hasDiscoverableDebugBearProject,
  isDebugBearExplicitlyEnabled,
  shouldRunDebugBear,
  shouldRunPsi,
  targetResolutionFailures = [],
  targets = [],
} = {}) {
  const failures = [...targetResolutionFailures];

  if (isDebugBearExplicitlyEnabled && !debugBearApiKey) {
    failures.push({
      label: 'debugbear',
      message:
        'OGABASSEY_CWV_DEBUGBEAR explicitly enabled DebugBear, but DEBUGBEAR_API_KEY/DEBUGBEAR_ADMIN_API_KEY is not configured.',
      source: 'configuration',
    });
  }

  if (isDebugBearExplicitlyEnabled && !hasDiscoverableDebugBearProject) {
    failures.push({
      label: 'debugbear-projects',
      message:
        'DebugBear requires DEBUGBEAR_PROJECT_ID, DEBUGBEAR_ADMIN_API_KEY, or an admin key in DEBUGBEAR_API_KEY before scheduling quick tests.',
      source: 'configuration',
    });
  }

  if (!shouldRunPsi && !shouldRunDebugBear) {
    failures.push({
      label: 'measurement',
      message:
        'No CWV provider is scheduled. Enable PageSpeed Insights or configure DebugBear with an API key and project discovery.',
      source: 'configuration',
    });
  }

  if (targets.length === 0) {
    failures.push({
      label: 'targets',
      message:
        'No CWV targets matched OGABASSEY_CWV_TARGET_LABELS. Use home, pdp-dell, blog-index, or blog-post-latest.',
      source: 'configuration',
    });
  }

  return failures;
}
