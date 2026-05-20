import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const ERROR_LEVELS = new Set(['error', 'fatal', 'panic']);
const ERROR_MESSAGE_RE =
  /\b(error|exception|unhandled|failed|timed out|timeout)\b/i;
const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const REQUEST_ID_RE = /\b(req|request|trace|span|dpl)_[a-z0-9_-]+\b/gi;
const NUMBER_RE = /\b\d+\b/g;
const URL_RE = /https?:\/\/\S+/gi;
const DYNAMIC_ROUTE_SEGMENT_RE = /\/[0-9a-f]{6,}(?=\/|$)|\/\d+(?=\/|$)/gi;

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function firstNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function normalizeVercelLogEvent(raw) {
  const entry = raw && typeof raw === 'object' ? raw : {};
  const error =
    entry.error && typeof entry.error === 'object' ? entry.error : {};
  const message = firstString(
    entry.message,
    entry.msg,
    entry.text,
    entry.body,
    error.message,
    entry.stack
  );
  const route = firstString(
    entry.route,
    entry.path,
    entry.pathname,
    entry.requestPath,
    entry.request?.path,
    entry.request?.url
  );

  return {
    deploymentId: firstString(entry.deploymentId, entry.deployment, entry.dpl),
    fingerprint: '',
    level: firstString(entry.level, entry.severity).toLowerCase(),
    message,
    projectName: firstString(entry.projectName, entry.project, entry.projectId),
    requestId: firstString(entry.requestId, entry.request?.id, entry.id),
    route,
    source: firstString(entry.source, entry.type),
    statusCode: firstNumber(
      entry.statusCode,
      entry.status,
      entry.response?.statusCode
    ),
    timestamp:
      firstString(entry.timestamp, entry.time, entry.createdAt) ||
      new Date().toISOString(),
  };
}

export function isErrorEvent(event) {
  if (!event) {
    return false;
  }
  if (ERROR_LEVELS.has(String(event.level || '').toLowerCase())) {
    return true;
  }
  if (Number(event.statusCode) >= 500) {
    return true;
  }
  return ERROR_MESSAGE_RE.test(event.message || '');
}

function normalizeMessageForFingerprint(message) {
  return String(message || '')
    .replace(URL_RE, '<url>')
    .replace(UUID_RE, '<uuid>')
    .replace(REQUEST_ID_RE, '<id>')
    .replace(/:\d+:\d+/g, ':<line>:<column>')
    .replace(/:\d+/g, ':<line>')
    .replace(NUMBER_RE, '<num>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 500);
}

function normalizeRouteForFingerprint(route) {
  return String(route || '')
    .split('?')[0]
    .replace(DYNAMIC_ROUTE_SEGMENT_RE, '/<id>')
    .replace(/\/+/g, '/')
    .toLowerCase()
    .slice(0, 160);
}

export function fingerprintErrorEvent(event) {
  const basis = [
    normalizeRouteForFingerprint(event.route),
    normalizeMessageForFingerprint(event.message),
  ].join('|');
  return createHash('sha256').update(basis).digest('hex').slice(0, 16);
}

export function groupErrorEvents(rawEvents) {
  const groups = new Map();
  for (const rawEvent of rawEvents) {
    const event = normalizeVercelLogEvent(rawEvent);
    if (!isErrorEvent(event)) {
      continue;
    }
    const fingerprint = fingerprintErrorEvent(event);
    event.fingerprint = fingerprint;
    const group = groups.get(fingerprint) || {
      deploymentIds: new Set(),
      events: [],
      fingerprint,
      firstSeen: event.timestamp,
      lastSeen: event.timestamp,
      requestIds: new Set(),
      sample: event,
    };
    group.events.push(event);
    if (event.deploymentId) {
      group.deploymentIds.add(event.deploymentId);
    }
    if (event.requestId) {
      group.requestIds.add(event.requestId);
    }
    if (event.timestamp < group.firstSeen) {
      group.firstSeen = event.timestamp;
    }
    if (event.timestamp > group.lastSeen) {
      group.lastSeen = event.timestamp;
    }
    groups.set(fingerprint, group);
  }
  return [...groups.values()].sort(
    (left, right) => right.events.length - left.events.length
  );
}

export function selectRemediationCandidates(
  groups,
  { minOccurrences = 2 } = {}
) {
  return groups
    .filter((group) => group.events.length >= minOccurrences)
    .map((group) => ({
      deploymentIds: [...group.deploymentIds],
      fingerprint: group.fingerprint,
      firstSeen: group.firstSeen,
      lastSeen: group.lastSeen,
      occurrences: group.events.length,
      requestIds: [...group.requestIds].slice(0, 10),
      sample: group.sample,
    }));
}

export function readJsonlLogEvents(path) {
  const content = readFileSync(path, 'utf8');
  const events = [];
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (!line.trim()) {
      continue;
    }
    try {
      events.push(JSON.parse(line));
    } catch (error) {
      throw new Error(
        `Invalid JSONL at ${path}:${index + 1}: ${error.message}`
      );
    }
  }
  return events;
}
