// biome-ignore-all format: compact direct-IP transport stays below the repository limit
import { promises as dns } from 'node:dns';
import https from 'node:https';

import { canonical, exact, fail, hash } from './owner-api-transport-primitives.mjs';
import { createPinnedApiPlan, validatePinnedAnswerSet, validatePinnedPeer } from './owner-api-transport-security.mjs';

const POLICY_KEYS = ['allowedQueryKeys', 'hostPattern', 'maxBytes', 'pathPrefix', 'timeoutsMs'];
const TIMEOUT_KEYS = ['bodyInactivity', 'connect', 'headers', 'overall'];
const SEALED_KEYS = ['policy', 'policyFileSha256', 'projectionSha256'];

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function validPolicy(policy) {
  if (!exact(policy, POLICY_KEYS) || !exact(policy.timeoutsMs, TIMEOUT_KEYS) || typeof policy.hostPattern !== 'string' || policy.hostPattern.length > 256 || !policy.hostPattern.startsWith('^') || !policy.hostPattern.endsWith('$') || typeof policy.pathPrefix !== 'string' || !/^\/[A-Za-z0-9._/-]+\/$/.test(policy.pathPrefix) || !Number.isInteger(policy.maxBytes) || policy.maxBytes < 1 || policy.maxBytes > 1024 * 1024 || !Array.isArray(policy.allowedQueryKeys) || policy.allowedQueryKeys.length < 1 || policy.allowedQueryKeys.length > 32 || new Set(policy.allowedQueryKeys).size !== policy.allowedQueryKeys.length || policy.allowedQueryKeys.some((key) => !/^[a-z0-9]{1,16}$/.test(key)) || TIMEOUT_KEYS.some((key) => !Number.isInteger(policy.timeoutsMs[key]) || policy.timeoutsMs[key] < 1 || policy.timeoutsMs[key] > 30000) || ['bodyInactivity', 'connect', 'headers'].some((key) => policy.timeoutsMs[key] > policy.timeoutsMs.overall)) fail('invalid transport policy');
  try { new RegExp(policy.hostPattern, 'u'); } catch { fail('invalid transport policy'); }
  return policy;
}

export function sealTransportPolicy(policy, policyFileSha256) {
  validPolicy(policy);
  if (!/^[a-f0-9]{64}$/.test(policyFileSha256)) fail('invalid transport policy');
  const normalized = JSON.parse(canonical(policy));
  return deepFreeze({ policy: normalized, policyFileSha256, projectionSha256: hash(canonical(normalized)) });
}

export function validateNetworkPlanPolicy(sealed, expectedPolicyFileSha256) {
  if (!exact(sealed, SEALED_KEYS) || sealed.policyFileSha256 !== expectedPolicyFileSha256 || !/^[a-f0-9]{64}$/.test(expectedPolicyFileSha256) || sealed.projectionSha256 !== hash(canonical(validPolicy(sealed.policy)))) fail('invalid transport policy');
  return true;
}

export async function readAnswers(hostname, connectTimeoutMs) {
  if (!Number.isInteger(connectTimeoutMs) || connectTimeoutMs < 1 || connectTimeoutMs > 30000) fail('invalid transport policy');
  let timer; const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DNS connect deadline')), connectTimeoutMs); });
  const rows = await Promise.race([dns.lookup(hostname, { all: true, verbatim: true }), timeout]).finally(() => clearTimeout(timer));
  return validatePinnedAnswerSet(hostname, [...new Set(rows.map((row) => row.address))]);
}

const responseBody = (chunks, maxBytes) => {
  const bytes = Buffer.concat(chunks);
  if (bytes.length > maxBytes) fail('response too large');
  return bytes;
};

function planSeal(plan) {
  return { policy: plan.transportPolicy, policyFileSha256: plan.transportPolicyFileSha256, projectionSha256: plan.transportPolicySha256 };
}

export function bindNetworkPolicy(basePlan, state, createdMonotonicMs, sealed) {
  validateNetworkPlanPolicy(sealed, state?.digests?.policy);
  const remaining = state?.deadlineMonotonicMs - createdMonotonicMs;
  if (!Number.isInteger(state?.deadlineMonotonicMs) || !Number.isInteger(createdMonotonicMs) || remaining <= 0) fail('overall deadline');
  const { policy } = sealed;
  const overallDeadlineMonotonicMs = Math.min(state.deadlineMonotonicMs, createdMonotonicMs + policy.timeoutsMs.overall);
  return {
    ...basePlan,
    bodyInactivityTimeoutMs: Math.min(policy.timeoutsMs.bodyInactivity, overallDeadlineMonotonicMs - createdMonotonicMs),
    connectDeadlineMonotonicMs: Math.min(overallDeadlineMonotonicMs, createdMonotonicMs + policy.timeoutsMs.connect),
    createdMonotonicMs,
    deadlineMonotonicMs: state.deadlineMonotonicMs,
    headersDeadlineMonotonicMs: Math.min(overallDeadlineMonotonicMs, createdMonotonicMs + policy.timeoutsMs.headers),
    maxBytes: policy.maxBytes,
    overallDeadlineMonotonicMs,
    transportPolicy: policy,
    transportPolicyFileSha256: sealed.policyFileSha256,
    transportPolicySha256: sealed.projectionSha256,
  };
}

export function validateRequestDeadlines(plan, nowMonotonicMs) {
  validateNetworkPlanPolicy(planSeal(plan), plan.transportPolicyFileSha256);
  if (!Number.isInteger(nowMonotonicMs) || nowMonotonicMs < plan.createdMonotonicMs || plan.maxBytes !== plan.transportPolicy.maxBytes) fail('invalid transport policy');
  const expected = bindNetworkPolicy({}, { deadlineMonotonicMs: plan.deadlineMonotonicMs, digests: { policy: plan.transportPolicyFileSha256 } }, plan.createdMonotonicMs, planSeal(plan));
  for (const key of ['bodyInactivityTimeoutMs', 'connectDeadlineMonotonicMs', 'headersDeadlineMonotonicMs', 'overallDeadlineMonotonicMs']) if (plan[key] !== expected[key]) fail('invalid transport policy');
  const remaining = (deadline) => deadline - nowMonotonicMs;
  const values = { bodyInactivityMs: plan.bodyInactivityTimeoutMs, connectMs: remaining(plan.connectDeadlineMonotonicMs), headersMs: remaining(plan.headersDeadlineMonotonicMs), overallMs: remaining(plan.overallDeadlineMonotonicMs) };
  if (Object.values(values).some((value) => !Number.isInteger(value) || value < 1)) fail('overall deadline');
  return values;
}

export function pinnedRequest(plan, { authorization, body: requestBody, method = 'GET', nowMonotonicMs = Number(process.hrtime.bigint() / 1_000_000n) } = {}) {
  const answers = validatePinnedAnswerSet(plan.hostname, plan.answers);
  if (plan.answerSetDigest !== hash(answers.join(',')) || plan.address !== answers[0]) fail('invalid peer address');
  if (authorization !== undefined && (!Buffer.isBuffer(authorization) || !authorization.length)) fail('invalid authorization buffer');
  const deadlines = validateRequestDeadlines(plan, nowMonotonicMs);
  const bytes = requestBody ? Buffer.from(JSON.stringify(requestBody)) : undefined;
  return new Promise((resolve, reject) => {
    let connectTimer; let headersTimer; let overallTimer;
    const clearTimers = () => { clearTimeout(connectTimer); clearTimeout(headersTimer); clearTimeout(overallTimer); };
    const request = https.request({
      hostname: plan.address, method, path: plan.path, servername: plan.servername, agent: false, joinDuplicateHeaders: false, maxHeaderSize: 8192,
      headers: { Accept: 'application/vnd.github+json', Connection: 'close', Host: plan.hostHeader, 'X-GitHub-Api-Version': '2026-03-10', ...(authorization ? { Authorization: authorization } : {}), ...(bytes ? { 'Content-Length': bytes.length, 'Content-Type': 'application/json' } : {}) },
    }, (response) => {
      clearTimeout(connectTimer); clearTimeout(headersTimer);
      response.setTimeout(deadlines.bodyInactivityMs, () => request.destroy(new Error('body inactivity deadline')));
      const chunks = []; let size = 0;
      response.on('data', (chunk) => { size += chunk.length; if (size > plan.maxBytes) request.destroy(new Error('response too large')); else chunks.push(chunk); });
      response.once('error', (error) => { clearTimers(); reject(error); });
      response.on('end', () => {
        clearTimers();
        if (response.socket.remoteAddress !== plan.address) return reject(new Error('unexpected peer'));
        const locationValues = []; const linkValues = [];
        for (let index = 0; index < response.rawHeaders.length; index += 2) if (response.rawHeaders[index].toLowerCase() === 'location') locationValues.push(response.rawHeaders[index + 1]); else if (response.rawHeaders[index].toLowerCase() === 'link') linkValues.push(response.rawHeaders[index + 1]);
        resolve({ body: responseBody(chunks, plan.maxBytes), headers: Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : (value ?? '')])), locationValues, linkValues, peer: { answerSetDigest: plan.answerSetDigest, answers, hostname: plan.hostname, remoteAddress: response.socket.remoteAddress, servername: plan.servername }, status: response.statusCode });
      });
    });
    connectTimer = setTimeout(() => request.destroy(new Error('connect deadline')), deadlines.connectMs);
    headersTimer = setTimeout(() => request.destroy(new Error('headers deadline')), deadlines.headersMs);
    overallTimer = setTimeout(() => request.destroy(new Error('overall deadline')), deadlines.overallMs);
    request.once('socket', (socket) => socket.once('secureConnect', () => clearTimeout(connectTimer)));
    request.once('error', (error) => { clearTimers(); reject(error); });
    if (bytes) request.write(bytes);
    request.end();
  });
}

export function jsonResponse(response) {
  if ([201, 202, 204].includes(response.status) && response.body.length === 0) return { ...response, body: undefined };
  let body; try { body = JSON.parse(response.body.toString('utf8')); } catch { fail('invalid JSON response'); }
  return { ...response, body };
}

export function createApiNetworkPlan(state, request, answers, createdMonotonicMs, sealed) {
  if (!Number.isInteger(createdMonotonicMs) || createdMonotonicMs < state.createdMonotonicMs || createdMonotonicMs >= state.deadlineMonotonicMs) fail('invalid network plan');
  const parsed = new URL(request.url);
  return Object.freeze({ ...bindNetworkPolicy(createPinnedApiPlan(state, request, answers), state, createdMonotonicMs, sealed), path: `${parsed.pathname}${parsed.search}`, requestSha256: hash(canonical(request)), stateDigest: state.stateDigest, stateGeneration: state.generation });
}

export async function sendApiRequest(state, request, token, plan) {
  const keys = ['address', 'answers', 'answerSetDigest', 'bodyInactivityTimeoutMs', 'connectDeadlineMonotonicMs', 'createdMonotonicMs', 'deadlineMonotonicMs', 'headersDeadlineMonotonicMs', 'hostHeader', 'hostname', 'maxBytes', 'maxRedirects', 'overallDeadlineMonotonicMs', 'path', 'requestSha256', 'servername', 'stateDigest', 'stateGeneration', 'transportPolicy', 'transportPolicyFileSha256', 'transportPolicySha256'];
  if (!exact(plan, keys) || plan.requestSha256 !== hash(canonical(request)) || plan.stateDigest !== state.stateDigest || plan.stateGeneration !== state.generation || plan.deadlineMonotonicMs !== state.deadlineMonotonicMs || plan.path !== `${new URL(request.url).pathname}${new URL(request.url).search}` || plan.transportPolicyFileSha256 !== state.digests.policy) fail('unpersisted network plan');
  const authorization = Buffer.alloc(7 + token.length); Buffer.from('Bearer ').copy(authorization); token.copy(authorization, 7);
  try {
    const response = await pinnedRequest(plan, { authorization, body: request.body, method: request.method });
    validatePinnedPeer(response.peer, plan);
    return { ...jsonResponse(response), receivedMonotonicMs: Number(process.hrtime.bigint() / 1_000_000n) };
  } finally { authorization.fill(0); }
}
