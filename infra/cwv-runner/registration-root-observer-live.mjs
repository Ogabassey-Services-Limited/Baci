import { canonicalSha256 } from './canonical-json.mjs';

const fail = () => {
  throw new TypeError('registration inspection refused');
};
const secret =
  /token|secret|password|credential|cookie|authorization|private.?key|api.?key|bearer|ghp_|ghs_|github_pat_|cfat_/i;
const statusValue = (text, key) =>
  new RegExp(`^${key}:\\s+(.+)$`, 'm').exec(text)?.[1].trim();
const cgroup = (bytes) => {
  const value = bytes.toString('utf8').trim();
  if (!/^0::\/[A-Za-z0-9_./@:-]+$/.test(value)) fail();
  return value.slice(3);
};
const parent = (bytes, allowInit = false) => {
  const value = Number(statusValue(bytes.toString('utf8'), 'PPid'));
  if (!Number.isSafeInteger(value) || value < (allowInit ? 1 : 2)) fail();
  return value;
};
function environment(bytes) {
  const values = Object.create(null);
  for (const item of bytes.toString('utf8').split('\0').filter(Boolean)) {
    const index = item.indexOf('=');
    const key = item.slice(0, index);
    const value = item.slice(index + 1);
    if (
      index < 1 ||
      !/^[A-Z][A-Z0-9_]{0,127}$/.test(key) ||
      secret.test(key) ||
      secret.test(value) ||
      key in values
    )
      fail();
    values[key] = value;
  }
  if (Object.keys(values).length === 0) fail();
  return values;
}
async function processRow(pid, read, link, allowInit) {
  const root = `/proc/${pid}`;
  const [status, cgroupBytes, executable] = await Promise.all([
    read(`${root}/status`),
    read(`${root}/cgroup`),
    link(`${root}/exe`),
  ]);
  if (!executable.startsWith('/') || executable.includes('\0')) fail();
  return {
    cgroupPath: cgroup(cgroupBytes),
    executable,
    executableSha256: canonicalSha256({ executable }),
    pid,
    parentPid: parent(status, allowInit),
  };
}

export async function collectRegistrationLiveProcessEvidence(
  pid,
  dependencies
) {
  const { read, link } = dependencies ?? {};
  if (
    !Number.isSafeInteger(pid) ||
    pid < 2 ||
    typeof read !== 'function' ||
    typeof link !== 'function'
  )
    fail();
  const [environmentBytes, shim] = await Promise.all([
    read(`/proc/${pid}/environ`),
    processRow(parent(await read(`/proc/${pid}/status`)), read, link),
  ]);
  const daemon = await processRow(shim.parentPid, read, link, true);
  if (
    !/\/containerd-shim-runc-v2$/.test(shim.executable) ||
    !/\/containerd$/.test(daemon.executable) ||
    !daemon.cgroupPath.endsWith('/baci-cwv-containerd.service') ||
    daemon.parentPid !== 1
  )
    fail();
  const chain = [
    {
      cgroupPath: shim.cgroupPath,
      executableSha256: shim.executableSha256,
      pid: shim.pid,
    },
    {
      cgroupPath: daemon.cgroupPath,
      executableSha256: daemon.executableSha256,
      pid: daemon.pid,
    },
  ];
  return Object.freeze({
    environmentSha256: canonicalSha256(environment(environmentBytes)),
    parentIdentitySha256: canonicalSha256({ chain, schemaVersion: 1 }),
  });
}
