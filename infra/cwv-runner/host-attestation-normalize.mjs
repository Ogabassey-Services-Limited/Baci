export { validateHostControlEvidence } from './host-control-evidence.mjs';

const fail = (name) => {
  throw new TypeError(`invalid ${name}`);
};

export function parseLscpuSummary(value) {
  if (!Array.isArray(value?.lscpu)) fail('lscpu');
  const rows = value.lscpu.map((row) => {
    if (typeof row?.field !== 'string' || typeof row?.data !== 'string')
      fail('lscpu row');
    const field = row.field.trim().replace(/:$/, '');
    if (!field || field.endsWith(':')) fail('lscpu label');
    return [field, row.data.trim()];
  });
  if (new Set(rows.map(([field]) => field)).size !== rows.length)
    fail('lscpu duplicate');
  return Object.fromEntries(rows);
}

export function parseMemTotal(value) {
  const match = /^MemTotal:[ \t]+([0-9]+) kB\n$/.exec(value);
  if (!match) fail('MemTotal');
  const total = Number(match[1]);
  if (!Number.isSafeInteger(total)) fail('MemTotal');
  return total;
}

export function parseOsRelease(value) {
  const result = {};
  for (const line of value.split('\n').filter(Boolean)) {
    const match = /^(ID|VERSION_ID|IMAGE_ID|IMAGE_VERSION)=(.*)$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    if (Object.hasOwn(result, key)) fail('os-release duplicate');
    if (raw.includes('\0')) fail('os-release quote');
    const quoted = /^(["'])(.*)\1$/.exec(raw);
    result[key] = quoted ? quoted[2].replace(/\\(["'\\])/g, '$1') : raw;
  }
  return result;
}

export function parseCloudflareTrace(value) {
  const allowed = new Set([
    'colo',
    'fl',
    'gateway',
    'h',
    'http',
    'ip',
    'kex',
    'loc',
    'rbi',
    'sliver',
    'sni',
    'tls',
    'ts',
    'uag',
    'visit_scheme',
    'warp',
  ]);
  const rows = value
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = /^([a-z_]+)=([^=\n]+)$/.exec(line);
      if (!match || !allowed.has(match[1])) fail('trace row');
      return match.slice(1);
    });
  const expected = ['ip', 'tls', 'warp'];
  if (
    new Set(rows.map(([key]) => key)).size !== rows.length ||
    expected.some((key) => !rows.some(([actual]) => actual === key))
  )
    fail('trace fields');
  return Object.fromEntries(rows.filter(([key]) => expected.includes(key)));
}

export function parseDns(value) {
  if (!value || typeof value !== 'object') fail('DNS input');
  const { defaultRoute: defaultStream, servers: serverStream, status } = value;
  const one = (stream, name) => {
    if (typeof stream !== 'string' || !stream.endsWith('\n')) fail(name);
    const line = stream.slice(0, -1);
    if (line.includes('\n')) fail(name);
    return line;
  };
  const serverLine = one(serverStream, 'DNS servers');
  const routeLine = one(defaultStream, 'DNS route');
  const servers =
    /^Link \d+ \(eth0\): ((?:\d{1,3}\.){3}\d{1,3}(?: (?:\d{1,3}\.){3}\d{1,3})*)$/
      .exec(serverLine)?.[1]
      ?.split(' ');
  const defaultRoute = /^Link \d+ \(eth0\): (yes|no)$/.exec(routeLine)?.[1];
  if (typeof status !== 'string') fail('DNS status');
  const statusLines = status.split('\n');
  const globalEnd = statusLines.findIndex((line) => /^Link \d+ \(/.test(line));
  const globalLines = statusLines.slice(
    0,
    globalEnd < 0 ? undefined : globalEnd
  );
  const matches = (pattern) =>
    globalLines.flatMap((line) => {
      const match = pattern.exec(line);
      return match ? [match[1]] : [];
    });
  const protocolRows = matches(/^\s*Protocols:\s+(.+)$/);
  const resolvRows = matches(/^\s*resolv\.conf mode:\s+([a-z]+)$/);
  if (protocolRows.length !== 1 || resolvRows.length !== 1) fail('DNS status');
  const tokens = protocolRows[0].trim().split(/ +/);
  const dnssecRows = tokens.filter((token) => token.startsWith('DNSSEC='));
  const protocolTokens = tokens.filter((token) => !token.startsWith('DNSSEC='));
  const dnssec = dnssecRows[0];
  if (
    !dnssec ||
    !servers ||
    !defaultRoute ||
    !protocolTokens.length ||
    dnssecRows.length !== 1 ||
    new Set(servers).size !== servers.length ||
    servers.some((server) =>
      server.split('.').some((part) => Number(part) > 255)
    )
  )
    fail('DNS');
  return {
    defaultRoute,
    dnssec,
    protocols: protocolTokens.join(','),
    resolvConf: resolvRows[0],
    servers: servers.sort(
      (left, right) =>
        left.split('.').reduce((value, part) => value * 256 + Number(part), 0) -
        right.split('.').reduce((value, part) => value * 256 + Number(part), 0)
    ),
  };
}

export function parseLocale(value) {
  if (!value || typeof value !== 'object') fail('locale input');
  const { charmap, status } = value;
  if (typeof status !== 'string' || typeof charmap !== 'string') fail('locale');
  const rows = status
    .split('\n')
    .flatMap((line) => /^\s*System Locale:\s+(.+)$/.exec(line)?.[1] ?? []);
  if (rows.length !== 1 || rows[0] !== 'LANG=C.UTF-8' || charmap !== 'UTF-8\n')
    fail('locale');
  return { charmap: 'UTF-8', lang: 'C.UTF-8' };
}
