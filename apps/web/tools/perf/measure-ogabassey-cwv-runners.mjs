import {
  getDebugBearQuickTestId,
  getDebugBearQuickTestPollPath,
} from './debugbear-quick-test-utils.mjs';
import { fetchJson } from './measure-ogabassey-cwv-network-utils.mjs';
import {
  buildPsiUrl,
  getDebugBearFailureMessage,
  isDebugBearComplete,
  summarizeDebugBearResult,
  summarizePsiResult,
} from './measure-ogabassey-cwv-summary-utils.mjs';
import {
  buildDebugBearHeaders,
  findDebugBearProjectIdForUrl,
  normalizeDebugBearProjects,
} from './measure-ogabassey-cwv-utils.mjs';

export function createPsiRunner({
  apiKey = '',
  fetchJsonImpl = fetchJson,
} = {}) {
  return async function runPsi(target, strategy) {
    const url = buildPsiUrl({ apiKey, strategy, url: target.url });
    const payload = await fetchJsonImpl(url);
    return {
      payload,
      summary: summarizePsiResult({
        label: target.label,
        payload,
        requestedUrl: target.url,
        strategy,
      }),
    };
  };
}

export function createDebugBearRunner({
  apiKey,
  adminApiKey = '',
  device = 'Mobile',
  fetchJsonImpl = fetchJson,
  maxPollAttempts = 90,
  pollIntervalMs = 5000,
  projectId = '',
  region = 'us-east',
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  function request(path, init = {}, requestApiKey = apiKey) {
    return fetchJsonImpl(`https://www.debugbear.com/api/v1${path}`, {
      ...init,
      headers: {
        ...buildDebugBearHeaders(requestApiKey),
        ...(init.headers || {}),
      },
    });
  }

  async function getProjects() {
    if (!adminApiKey) {
      throw new Error(
        'Set DEBUGBEAR_ADMIN_API_KEY for project discovery or DEBUGBEAR_PROJECT_ID to skip discovery'
      );
    }
    const body = await request('/projects', {}, adminApiKey);
    return normalizeDebugBearProjects(body);
  }

  async function run(target, projects) {
    const resolvedProjectId =
      projectId ||
      findDebugBearProjectIdForUrl(projects, target.url, {
        deviceName: device,
      });
    if (!resolvedProjectId) {
      throw new Error(`No DebugBear project found for ${target.url}`);
    }

    const created = await request(`/project/${resolvedProjectId}/quickTests`, {
      body: JSON.stringify([{ device, region, url: target.url }]),
      method: 'POST',
    });
    const quickTestId = getDebugBearQuickTestId(created);
    if (!quickTestId) {
      throw new Error('DebugBear quick test response did not include an id');
    }

    const pollPath = getDebugBearQuickTestPollPath({
      body: created,
      projectId: resolvedProjectId,
      quickTestId,
    });
    let result = created;
    for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
      result = await request(pollPath);
      if (isDebugBearComplete(result)) break;
      await sleep(pollIntervalMs);
    }
    if (!isDebugBearComplete(result)) {
      throw new Error(
        `DebugBear poll timed out for ${target.label} after ${maxPollAttempts} attempts`
      );
    }

    const failureMessage = getDebugBearFailureMessage(result);
    const payload = { created, result };
    if (failureMessage) return { failure: failureMessage, payload };

    return {
      payload,
      summary: summarizeDebugBearResult({
        body: result,
        device,
        label: target.label,
        projectId: resolvedProjectId,
        quickTestId,
        region,
        url: target.url,
      }),
    };
  }

  return { getProjects, run };
}
