import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { canonicalJson } from './canonical-json.mjs';

export { canonicalJson };

export const networkInventoryNames = Object.freeze([
  'nftables',
  'iptables',
  'ip6tables',
  'ipRules4',
  'ipRules6',
  'tc',
  'conntrack',
  'addresses',
  'routes',
  'dockerNetworks',
]);
export const volatileNetworkInventoryNames = Object.freeze([
  'nftables',
  'tc',
  'conntrack',
]);
export const stableNetworkInventoryNames = Object.freeze(
  networkInventoryNames.filter(
    (name) => !volatileNetworkInventoryNames.includes(name)
  )
);

export const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex');

export function createNetworkSnapshot({
  campaignMark,
  externalInterface,
  inventoryBytes,
}) {
  if (
    !Number.isSafeInteger(campaignMark) ||
    campaignMark < 0 ||
    campaignMark > 0xffffffff ||
    !externalInterface ||
    typeof externalInterface.name !== 'string' ||
    !Number.isSafeInteger(externalInterface.ifindex) ||
    externalInterface.ifindex <= 0 ||
    !inventoryBytes ||
    Object.keys(inventoryBytes).sort().join('\n') !==
      [...networkInventoryNames].sort().join('\n')
  )
    throw new Error('complete network baseline mismatch');
  const inventories = Object.fromEntries(
    networkInventoryNames.map((name) => {
      const bytes = inventoryBytes[name];
      if (!(typeof bytes === 'string' || ArrayBuffer.isView(bytes)))
        throw new Error('complete network baseline mismatch');
      return [name, sha256(bytes)];
    })
  );
  const base = {
    ipForward: 1,
    campaignMark,
    collisions: [],
    accountingTablePresent: false,
    externalInterface,
    inventories: Object.fromEntries(
      stableNetworkInventoryNames.map((name) => [name, inventories[name]])
    ),
  };
  return {
    ...base,
    inventories,
    baselineSha256: sha256(`${canonicalJson(base)}\n`),
  };
}

export function verifyStableNetworkSnapshot(expected, inventoryBytes) {
  if (
    !expected ||
    Object.keys(inventoryBytes).sort().join('\n') !==
      [...stableNetworkInventoryNames].sort().join('\n')
  )
    throw new Error('stable network baseline mismatch');
  const inventories = Object.fromEntries(
    stableNetworkInventoryNames.map((name) => {
      const bytes = inventoryBytes[name];
      if (!(typeof bytes === 'string' || ArrayBuffer.isView(bytes)))
        throw new Error('stable network baseline mismatch');
      return [name, sha256(bytes)];
    })
  );
  const base = {
    ipForward: 1,
    campaignMark: expected.campaignMark,
    collisions: [],
    accountingTablePresent: false,
    externalInterface: expected.externalInterface,
    inventories,
  };
  if (
    canonicalJson(inventories) !==
      canonicalJson(
        Object.fromEntries(
          stableNetworkInventoryNames.map((name) => [
            name,
            expected.inventories?.[name],
          ])
        )
      ) ||
    expected.baselineSha256 !== sha256(`${canonicalJson(base)}\n`)
  )
    throw new Error('stable network baseline mismatch');
  return { ...base, baselineSha256: expected.baselineSha256 };
}

export function verifyNetworkSnapshot(expected, inventoryBytes) {
  const actual = createNetworkSnapshot({
    campaignMark: expected.campaignMark,
    externalInterface: expected.externalInterface,
    inventoryBytes,
  });
  if (canonicalJson(actual) !== canonicalJson(expected))
    throw new Error('complete network baseline mismatch');
  return actual;
}

export async function readInventoryDirectory(directory) {
  return Object.fromEntries(
    await Promise.all(
      networkInventoryNames.map(async (name) => [
        name,
        await readFile(`${directory}/${name}`),
      ])
    )
  );
}

async function main([command, ...args]) {
  if (command !== 'capture' || args.length !== 4)
    throw new Error('network contract command required');
  const [directory, mark, externalName, externalIfindex] = args;
  const snapshot = createNetworkSnapshot({
    campaignMark: Number(mark),
    externalInterface: {
      name: externalName,
      ifindex: Number(externalIfindex),
    },
    inventoryBytes: await readInventoryDirectory(directory),
  });
  process.stdout.write(`${canonicalJson(snapshot)}\n`);
}

if (import.meta.filename === process.argv[1])
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
