import { createHash } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import https from 'node:https';

const fail = (label) => {
  throw new TypeError(`invalid ${label}`);
};
const valid = (condition, label) => condition || fail(label);
const publicIpv4 = (value) => {
  const octets = value.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  )
    return false;
  const [a, b] = octets;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && [0, 168].includes(b)) ||
    (a === 198 && [18, 19, 51].includes(b)) ||
    (a === 203 && b === 0)
  );
};

export function requestSemanticJson(url, options) {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    let connectTimer;
    const request = https.get(
      {
        agent: false,
        headers: {
          accept: 'application/json',
          host: target.host,
          'user-agent': 'baci-cwv-provenance',
        },
        host: options.address,
        method: 'GET',
        path: `${target.pathname}${target.search}`,
        port: 443,
        rejectUnauthorized: true,
        servername: options.servername,
        signal: options.signal,
      },
      (response) => {
        response.setTimeout(options.bodyInactivityTimeoutMs, () =>
          request.destroy(new TypeError('semantic metadata timeout'))
        );
        response.on('data', (chunk) => {
          total += chunk.length;
          if (total > 1_048_576)
            request.destroy(new TypeError('semantic metadata too large'));
          else chunks.push(chunk);
        });
        response.on('end', () =>
          resolve({
            body: Buffer.concat(chunks).toString('utf8'),
            headers: response.headers,
            remoteAddress: response.socket.remoteAddress,
            status: response.statusCode,
          })
        );
      }
    );
    const headerTimer = setTimeout(
      () => request.destroy(new TypeError('semantic metadata timeout')),
      options.headerTimeoutMs
    );
    request.once('socket', (socket) => {
      connectTimer = setTimeout(
        () => request.destroy(new TypeError('semantic metadata timeout')),
        options.connectTimeoutMs
      );
      socket.once('secureConnect', () => clearTimeout(connectTimer));
    });
    request.once('response', () => clearTimeout(headerTimer));
    request.once('error', (error) => {
      clearTimeout(connectTimer);
      clearTimeout(headerTimer);
      reject(error);
    });
  });
}

const defaultResolver = () => new Resolver();
const noOp = () => undefined;
const abortReason = (signal) =>
  signal?.reason instanceof Error
    ? signal.reason
    : new TypeError('semantic metadata aborted');
const resolveDns = (hostname, limits) => {
  if (limits.resolver) {
    const cancel = limits.resolver.cancel?.bind(limits.resolver) ?? noOp;
    return { cancel, promise: limits.resolver(hostname) };
  }
  const resolver = (limits.resolverFactory ?? defaultResolver)();
  return {
    cancel: resolver.cancel?.bind(resolver) ?? noOp,
    promise: resolver.resolve4(hostname),
  };
};
const validateTarget = (target, origins) => {
  valid(
    target.protocol === 'https:' &&
      !target.username &&
      !target.password &&
      (!target.port || target.port === '443') &&
      origins.includes(target.origin.toLowerCase()),
    'semantic metadata origin refused'
  );
};

export async function fetchSemanticJson(
  url,
  origins,
  requester = requestSemanticJson,
  limits = {}
) {
  const deadline =
    performance.now() + Math.min(limits.overallTimeoutMs ?? 30_000, 30_000);
  const visited = new Set();
  let current = new URL(url);
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    validateTarget(current, origins);
    if (visited.has(current.href)) fail('semantic metadata redirect loop');
    visited.add(current.href);
    const dnsTimeout = Math.max(1, deadline - performance.now());
    let dnsTimer;
    const dns = resolveDns(current.hostname, limits);
    let abortDns;
    const abortPromise = limits.signal
      ? new Promise((_, reject) => {
          abortDns = () => {
            dns.cancel();
            reject(abortReason(limits.signal));
          };
          if (limits.signal.aborted) abortDns();
          else
            limits.signal.addEventListener('abort', abortDns, { once: true });
        })
      : undefined;
    let resolved;
    try {
      resolved = await Promise.race([
        dns.promise,
        new Promise((_, reject) => {
          dnsTimer = setTimeout(() => {
            dns.cancel();
            reject(new TypeError('semantic metadata timeout'));
          }, dnsTimeout);
        }),
        ...(abortPromise ? [abortPromise] : []),
      ]);
    } finally {
      clearTimeout(dnsTimer);
      if (abortDns) limits.signal.removeEventListener('abort', abortDns);
    }
    const answers = [...new Set(resolved)].sort();
    valid(
      answers.length > 0 && answers.length <= 16 && answers.every(publicIpv4),
      'semantic metadata DNS answer'
    );
    const address = answers[0];
    const controller = new AbortController();
    const abortRequest = () => controller.abort(limits.signal?.reason);
    if (limits.signal?.aborted) abortRequest();
    else limits.signal?.addEventListener('abort', abortRequest, { once: true });
    const timeout = Math.max(1, deadline - performance.now());
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new TypeError('semantic metadata timeout'));
        controller.abort();
      }, timeout);
    });
    let response;
    try {
      if (controller.signal.aborted) throw abortReason(limits.signal);
      const requestPromise = requester(current.href, {
        address,
        answerSetSha256: createHash('sha256')
          .update(`${answers.join('\n')}\n`)
          .digest('hex'),
        bodyInactivityTimeoutMs: 10_000,
        connectTimeoutMs: 10_000,
        credentials: false,
        headerTimeoutMs: 10_000,
        hostname: current.hostname,
        rejectUnauthorized: true,
        servername: current.hostname,
        signal: controller.signal,
      });
      response = await Promise.race([requestPromise, timeoutPromise]);
    } finally {
      clearTimeout(timer);
      limits.signal?.removeEventListener('abort', abortRequest);
    }
    valid(response && typeof response.body === 'string', 'response');
    valid(
      response.remoteAddress === address,
      'semantic metadata remote address'
    );
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      valid(response.headers?.location && redirects < 5, 'redirect');
      current = new URL(response.headers.location, current);
      validateTarget(current, origins);
      continue;
    }
    valid(response.status === 200, 'semantic metadata status');
    valid(
      /^application\/json(?:\s*;|$)/i.test(
        response.headers?.['content-type'] ?? ''
      ),
      'semantic metadata content type'
    );
    valid(
      Buffer.byteLength(response.body) <= 1_048_576,
      'semantic metadata too large'
    );
    try {
      return JSON.parse(response.body);
    } catch {
      fail('semantic metadata JSON');
    }
  }
  fail('semantic metadata redirect');
}
