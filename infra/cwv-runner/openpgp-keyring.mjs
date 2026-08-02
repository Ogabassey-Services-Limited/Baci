import { createHash } from 'node:crypto';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fail = (label) => {
  throw new TypeError(`invalid ${label}`);
};
const crc24 = (bytes) => {
  let crc = 0xb704ce;
  for (const byte of bytes) {
    crc ^= byte << 16;
    for (let bit = 0; bit < 8; bit += 1) {
      crc <<= 1;
      if ((crc & 0x1000000) !== 0) crc ^= 0x1864cfb;
    }
  }
  return crc & 0xffffff;
};
const packetLength = (bytes, offset, oldFormat) => {
  const first = bytes[offset];
  if (first === undefined) fail('OpenPGP packet length');
  if (oldFormat === 0) return { length: first, octets: 1 };
  if (oldFormat === 1) {
    if (offset + 2 > bytes.length) fail('OpenPGP packet length');
    return { length: bytes.readUInt16BE(offset), octets: 2 };
  }
  if (oldFormat === 2) {
    if (offset + 4 > bytes.length) fail('OpenPGP packet length');
    return { length: bytes.readUInt32BE(offset), octets: 4 };
  }
  if (first < 192) return { length: first, octets: 1 };
  if (first < 224) {
    if (offset + 2 > bytes.length) fail('OpenPGP packet length');
    return { length: (first - 192) * 256 + bytes[offset + 1] + 192, octets: 2 };
  }
  if (first === 255) {
    if (offset + 5 > bytes.length) fail('OpenPGP packet length');
    return { length: bytes.readUInt32BE(offset + 1), octets: 5 };
  }
  fail('OpenPGP partial packet');
};
const validatePackets = (bytes) => {
  let offset = 0;
  let publicKeys = 0;
  while (offset < bytes.length) {
    const header = bytes[offset];
    if ((header & 0x80) === 0) fail('OpenPGP packet header');
    const isNew = (header & 0x40) !== 0;
    const tag = isNew ? header & 0x3f : (header >> 2) & 0x0f;
    const parsed = packetLength(bytes, offset + 1, isNew ? -1 : header & 3);
    offset += 1 + parsed.octets + parsed.length;
    if (offset > bytes.length || parsed.length === 0) fail('OpenPGP packet');
    if (tag === 5 || tag === 7) fail('OpenPGP secret key');
    if (tag === 6) publicKeys += 1;
  }
  if (offset !== bytes.length || publicKeys === 0) fail('OpenPGP public key');
};

export function decodeArmoredPublicKey(bytes, expectedSha256) {
  if (
    !/^[0-9a-f]{64}$/.test(expectedSha256) ||
    createHash('sha256').update(bytes).digest('hex') !== expectedSha256
  )
    throw new TypeError('invalid Chrome signing key digest');
  if (bytes.includes(0) || bytes.some((byte) => byte > 0x7f))
    fail('OpenPGP ASCII armor');
  const text = bytes.toString('ascii').replaceAll('\r\n', '\n');
  if (text.includes('\r')) fail('OpenPGP ASCII armor');
  const blocks = [
    ...text.matchAll(
      /-----BEGIN PGP PUBLIC KEY BLOCK-----\n(?:[A-Za-z][A-Za-z0-9-]*: [ -~]+\n)*\n([A-Za-z0-9+/=\n]+)\n=([A-Za-z0-9+/]{4})\n-----END PGP PUBLIC KEY BLOCK-----\n?/g
    ),
  ];
  if (blocks.length === 0 || blocks.map(([block]) => block).join('') !== text)
    fail('OpenPGP ASCII armor');
  return Buffer.concat(
    blocks.map((match) => {
      const encoded = match[1].replaceAll('\n', '');
      const binary = Buffer.from(encoded, 'base64');
      if (binary.length === 0 || binary.toString('base64') !== encoded)
        fail('OpenPGP base64');
      const checksum = Buffer.from(match[2], 'base64');
      if (checksum.length !== 3 || checksum.toString('base64') !== match[2])
        fail('OpenPGP armor checksum');
      if (checksum.readUIntBE(0, 3) !== crc24(binary))
        fail('OpenPGP armor checksum');
      validatePackets(binary);
      return binary;
    })
  );
}

export function withArmoredOpenPgpKeyring(
  { armoredKeyPath, expectedSha256, temporaryRoot = tmpdir() },
  consumeKeyring
) {
  const binary = decodeArmoredPublicKey(
    readFileSync(armoredKeyPath),
    expectedSha256
  );
  const directory = mkdtempSync(join(temporaryRoot, '.baci-cwv-keyring-'));
  try {
    chmodSync(directory, 0o700);
    const keyring = join(directory, 'chrome-signing-key.gpg');
    writeFileSync(keyring, binary, { flag: 'wx', mode: 0o600 });
    return consumeKeyring({
      environment: {
        GNUPGHOME: directory,
        HOME: directory,
        LANG: 'C',
        LC_ALL: 'C',
      },
      keyring,
    });
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}
