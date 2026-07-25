import { canonicalSha256 } from './canonical-json.mjs';

const base = {
  deniedDestinationCidrs: Object.freeze([
    '10.0.0.0/8',
    '127.0.0.0/8',
    '169.254.0.0/16',
    '172.16.0.0/12',
    '172.18.0.0/16',
    '192.168.0.0/16',
    '82.29.190.219/32',
  ]),
  externalIfindex: 2,
  externalInterface: 'eth0',
  nonrootServiceUids: Object.freeze([1000, 10001, 10002]),
};

const plan = {
  forward: [
    ['-i', 'baci-cwv0', '!', '-s', '172.31.255.0/28', '-j', 'REJECT'],
    ...['172.31.255.1/32', ...base.deniedDestinationCidrs].map((cidr) => [
      '-i',
      'baci-cwv0',
      '-s',
      '172.31.255.0/28',
      '-d',
      cidr,
      '-j',
      'REJECT',
    ]),
    ...['udp', 'tcp'].map((protocol) => [
      '-i',
      'baci-cwv0',
      '-s',
      '172.31.255.0/28',
      '-o',
      'eth0',
      '-p',
      protocol,
      '--dport',
      '53',
      '-j',
      'ACCEPT',
    ]),
    [
      '-i',
      'baci-cwv0',
      '-s',
      '172.31.255.0/28',
      '-o',
      'eth0',
      '-p',
      'tcp',
      '--dport',
      '443',
      '-j',
      'ACCEPT',
    ],
    [
      '-i',
      'eth0',
      '-o',
      'baci-cwv0',
      '-d',
      '172.31.255.0/28',
      '-m',
      'conntrack',
      '--ctstate',
      'ESTABLISHED,RELATED',
      '-j',
      'ACCEPT',
    ],
    ['-i', 'baci-cwv0', '-j', 'REJECT'],
  ],
  input: [
    ['-i', 'baci-cwv0', '!', '-s', '172.31.255.0/28', '-j', 'REJECT'],
    ['-i', 'baci-cwv0', '-s', '172.31.255.0/28', '-j', 'REJECT'],
  ],
  schemaVersion: 1,
};

export const registrationNetworkAuthority = Object.freeze({
  ...base,
  expectedEgressPlanSha256: canonicalSha256(plan),
});
