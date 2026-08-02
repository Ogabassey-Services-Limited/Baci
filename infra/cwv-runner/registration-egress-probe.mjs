import { Resolver } from 'node:dns/promises';
import { readFileSync } from 'node:fs';
import { BlockList, isIPv4 } from 'node:net';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from './canonical-json.mjs';
import { parseRunnerPolicy, requireRunnerPolicy } from './policy.schema.mjs';

const policyUrl = new URL('./policy.json', import.meta.url);

function connectTls(options, signal) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(options);
    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener('abort', abort);
      socket.removeListener('error', fail);
      socket.removeListener('timeout', timedOut);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      socket.destroy();
      reject(error);
    };
    const abort = () => fail(new Error('registration probe timed out'));
    const timedOut = () => fail(new Error('registration probe timed out'));
    signal?.addEventListener('abort', abort, { once: true });
    socket.once('error', fail);
    socket.once('timeout', timedOut);
    socket.once('secureConnect', () => {
      if (settled) return;
      settled = true;
      cleanup();
      socket.destroy();
      resolve();
    });
    if (signal?.aborted) abort();
  });
}

export async function probeRegistrationEgress(value, dependencies = {}) {
  const policy = requireRunnerPolicy(value);
  const {
    registrationProbeHost: host,
    registrationProbePort: port,
    registrationProbeTimeoutSeconds: timeoutSeconds,
  } = policy.dedicatedRuntime;
  const resolver = dependencies.resolver ?? new Resolver();
  const connect = dependencies.connect ?? connectTls;
  const now = dependencies.now ?? (() => performance.now());
  const schedule = dependencies.setTimeout ?? globalThis.setTimeout;
  const cancel = dependencies.clearTimeout ?? globalThis.clearTimeout;
  const timeoutMilliseconds = timeoutSeconds * 1000;
  const started = now();
  const controller = new AbortController();
  let resolverCancelled = false;
  const cancelResolver = () => {
    if (resolverCancelled) return;
    resolverCancelled = true;
    resolver.cancel();
  };
  let expired = false;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = schedule(() => {
      expired = true;
      reject(new Error('registration probe timed out'));
      cancelResolver();
      controller.abort();
    }, timeoutMilliseconds);
  });
  const operation = (async () => {
    const addresses = await resolver.resolve4(host);
    const denied = new BlockList();
    for (const cidr of policy.dedicatedRuntime.deniedDestinationCidrs) {
      const [network, prefix] = cidr.split('/');
      denied.addSubnet(network, Number(prefix), 'ipv4');
    }
    if (
      !Array.isArray(addresses) ||
      addresses.length === 0 ||
      addresses.length > 16 ||
      new Set(addresses).size !== addresses.length ||
      addresses.some(
        (address) => !isIPv4(address) || denied.check(address, 'ipv4')
      )
    )
      throw new Error('registration probe DNS refused');
    const address = [...addresses].sort((left, right) => {
      const word = (value) =>
        value
          .split('.')
          .reduce((result, octet) => result * 256 + Number(octet), 0);
      return word(left) - word(right);
    })[0];
    const remaining = timeoutMilliseconds - (now() - started);
    if (expired || remaining <= 0)
      throw new Error('registration probe timed out');
    await connect(
      {
        host: address,
        port,
        rejectUnauthorized: true,
        servername: host,
        timeout: remaining,
      },
      controller.signal
    );
    if (expired) throw new Error('registration probe timed out');
    return { ok: true };
  })();
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    cancel(timer);
    cancelResolver();
  }
}

export function runRegistrationProbeCli(policyBytes, dependencies = {}) {
  return probeRegistrationEgress(
    parseRunnerPolicy(JSON.parse(policyBytes.toString('utf8'))),
    dependencies
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 2)
    throw new TypeError('probe accepts no arguments');
  process.stdout.write(
    `${canonicalJson(await runRegistrationProbeCli(readFileSync(policyUrl)))}\n`
  );
}
