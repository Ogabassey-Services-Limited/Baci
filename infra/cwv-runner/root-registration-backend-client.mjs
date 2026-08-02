import { spawn as spawnChild } from 'node:child_process';

const BACKEND = '/srv/baci-cwv/sealed/registration-root-operations.mjs';
const NODE = '/usr/bin/node';
const MAXIMUM_BYTES = 16_384;
const fail = () => {
  throw new TypeError('root operation refused');
};
const validSecret = (value) =>
  Buffer.isBuffer(value) && value.length >= 21 && value.length <= 129;

function requireRequest(request, secret) {
  if (
    typeof request !== 'string' ||
    Buffer.byteLength(request, 'utf8') >= MAXIMUM_BYTES ||
    (secret !== undefined && !validSecret(secret))
  )
    fail();
}

function createChild(dependencies) {
  const spawn = dependencies.spawn ?? spawnChild;
  if (typeof spawn !== 'function') fail();
  let child;
  try {
    child = spawn(NODE, [BACKEND, '--execute'], {
      env: { LC_ALL: 'C.UTF-8', TZ: 'Etc/UTC' },
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
    });
  } catch {
    fail();
  }
  if (
    !child?.stdin ||
    !child.stdout ||
    !child.stderr ||
    !child.stdio?.[3] ||
    typeof child.once !== 'function' ||
    typeof child.kill !== 'function' ||
    typeof child.stdin.once !== 'function' ||
    typeof child.stdin.end !== 'function' ||
    typeof child.stdout.on !== 'function' ||
    typeof child.stderr.on !== 'function' ||
    typeof child.stdio[3].once !== 'function' ||
    typeof child.stdio[3].end !== 'function'
  ) {
    try {
      child?.kill?.('SIGKILL');
    } catch {
      // The child may have exited between spawn and validation.
    }
    fail();
  }
  return child;
}

export function createRegistrationBackendClient(dependencies = {}) {
  const setTimer = dependencies.setTimeout ?? setTimeout;
  const clearTimer = dependencies.clearTimeout ?? clearTimeout;
  if (typeof setTimer !== 'function' || typeof clearTimer !== 'function')
    fail();
  let child;
  let closed = false;
  let pending;
  let output = Buffer.alloc(0);
  const terminate = () => {
    try {
      child?.kill('SIGKILL');
    } catch {
      // The child may already be gone.
    }
  };
  const refuse = (terminateChild = true) => {
    if (terminateChild) terminate();
    if (!pending) return;
    const current = pending;
    pending = undefined;
    clearTimer(current.timer);
    current.secret?.fill(0);
    current.reject(new TypeError('root operation refused'));
  };
  const receive = (chunk) => {
    if (!Buffer.isBuffer(chunk) || !pending) return refuse();
    output = Buffer.concat([output, chunk]);
    if (output.length > MAXIMUM_BYTES) return refuse();
    const end = output.indexOf(10);
    if (end < 0) return;
    const line = output.subarray(0, end + 1).toString('utf8');
    output = output.subarray(end + 1);
    if (output.length) return refuse();
    const current = pending;
    current.line = line;
    queueMicrotask(() => {
      if (pending !== current) return;
      pending = undefined;
      clearTimer(current.timer);
      current.secret?.fill(0);
      current.resolve(line);
    });
  };
  const start = () => {
    if (child) return;
    child = createChild(dependencies);
    child.stdout.on('data', receive);
    child.stderr.on('data', () => refuse());
    child.once('error', () => refuse());
    child.stdin.once('error', () => refuse());
    child.stdio[3].once('error', () => refuse());
    child.once('close', () => {
      closed = true;
      queueMicrotask(() => refuse(false));
    });
  };
  return Object.freeze({
    close() {
      if (closed) return;
      closed = true;
      try {
        child?.stdin.end();
      } catch {
        terminate();
      }
    },
    execute(request, options = {}) {
      const secret = options?.secret;
      requireRequest(request, secret);
      if (
        closed ||
        pending ||
        (options && Object.keys(options).join(',') !== (secret ? 'secret' : ''))
      )
        fail();
      try {
        start();
      } catch {
        return Promise.reject(new TypeError('root operation refused'));
      }
      return new Promise((resolve, reject) => {
        const timer = setTimer(() => refuse(), 15_000);
        pending = { reject, resolve, secret, timer };
        if (secret !== undefined) {
          child.stdio[3].once('finish', () => secret.fill(0));
          try {
            child.stdio[3].end(secret);
          } catch {
            return refuse();
          }
        }
        try {
          child.stdin.write(`${request}\n`);
        } catch {
          refuse();
        }
      });
    },
  });
}

export function executeRegistrationBackend(request, dependencies = {}) {
  const backend = createRegistrationBackendClient(dependencies);
  return backend
    .execute(
      request,
      dependencies.secret ? { secret: dependencies.secret } : {}
    )
    .finally(() => backend.close());
}
