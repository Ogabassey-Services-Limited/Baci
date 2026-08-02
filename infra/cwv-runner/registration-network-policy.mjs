import { canonicalSha256 } from './canonical-json.mjs';

const BRIDGE = 'baci-cwv0';
const SUBNET = '172.31.255.0/28';
const CIDR =
  /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\/(?:[0-9]|[12]\d|3[0-2])$/;
const INTERFACE = /^[A-Za-z0-9_.-]{1,15}$/;

const fail = () => {
  throw new TypeError('registration firewall policy refused');
};

function requireNetworkAuthority(authority) {
  if (
    !authority ||
    typeof authority !== 'object' ||
    Array.isArray(authority) ||
    Object.keys(authority).sort().join(',') !==
      'deniedDestinationCidrs,expectedEgressPlanSha256,externalIfindex,externalInterface,nonrootServiceUids' ||
    !INTERFACE.test(authority.externalInterface) ||
    !/^[a-f0-9]{64}$/.test(authority.expectedEgressPlanSha256) ||
    !Number.isSafeInteger(authority.externalIfindex) ||
    authority.externalIfindex < 1 ||
    !Array.isArray(authority.deniedDestinationCidrs) ||
    authority.deniedDestinationCidrs.length === 0 ||
    !Array.isArray(authority.nonrootServiceUids) ||
    authority.nonrootServiceUids.length === 0
  )
    fail();
  const cidrs = authority.deniedDestinationCidrs;
  const uids = authority.nonrootServiceUids;
  if (
    !cidrs.every((cidr) => typeof cidr === 'string' && CIDR.test(cidr)) ||
    !uids.every((uid) => Number.isSafeInteger(uid) && uid > 0) ||
    [...cidrs].sort().join('\n') !== cidrs.join('\n') ||
    [...uids].sort((left, right) => left - right).join(',') !==
      uids.join(',') ||
    new Set(cidrs).size !== cidrs.length ||
    new Set(uids).size !== uids.length
  )
    fail();
  return Object.freeze({
    deniedDestinationCidrs: Object.freeze([...cidrs]),
    expectedEgressPlanSha256: authority.expectedEgressPlanSha256,
    externalIfindex: authority.externalIfindex,
    externalInterface: authority.externalInterface,
    nonrootServiceUids: Object.freeze([...uids]),
  });
}

export function firewallPolicy(identity) {
  const authority = requireNetworkAuthority(identity?.networkAuthority);
  const reject = ['-j', 'REJECT'];
  const source = ['-i', BRIDGE, '-s', SUBNET];
  const outside = ['-i', BRIDGE, '!', '-s', SUBNET, ...reject];
  const denied = ['172.31.255.1/32', ...authority.deniedDestinationCidrs].map(
    (range) => [...source, '-d', range, ...reject]
  );
  const probeAllowRules = [
    [
      ...source,
      '-o',
      authority.externalInterface,
      '-p',
      'udp',
      '--dport',
      '53',
      '-j',
      'ACCEPT',
    ],
    [
      ...source,
      '-o',
      authority.externalInterface,
      '-p',
      'tcp',
      '--dport',
      '53',
      '-j',
      'ACCEPT',
    ],
    [
      ...source,
      '-o',
      authority.externalInterface,
      '-p',
      'tcp',
      '--dport',
      '443',
      '-j',
      'ACCEPT',
    ],
  ];
  const defaultDropRule = ['-i', BRIDGE, ...reject];
  const result = Object.freeze({
    forward: Object.freeze([
      outside,
      ...denied,
      ...probeAllowRules,
      [
        '-i',
        authority.externalInterface,
        '-o',
        BRIDGE,
        '-d',
        SUBNET,
        '-m',
        'conntrack',
        '--ctstate',
        'ESTABLISHED,RELATED',
        '-j',
        'ACCEPT',
      ],
      defaultDropRule,
    ]),
    input: Object.freeze([outside, [...source, ...reject]]),
    defaultDropRule: Object.freeze(defaultDropRule),
    names: Object.freeze({
      bridge: BRIDGE,
      externalInterface: authority.externalInterface,
      subnet: SUBNET,
      ...identity,
    }),
    probeAllowRules: Object.freeze(probeAllowRules.map(Object.freeze)),
  });
  if (
    authority.expectedEgressPlanSha256 !==
    // biome-ignore format: fixed canonical egress digest stays auditable in one row
    canonicalSha256({ forward: result.forward, input: result.input, schemaVersion: 1 })
  )
    fail();
  return result;
}

export const policyRows = (chain, rules) =>
  rules.map((rule) => `-A ${chain} ${rule.join(' ')}`);
