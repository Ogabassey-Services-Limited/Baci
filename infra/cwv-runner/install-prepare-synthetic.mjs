import { createHash } from 'node:crypto';
import { open, unlink } from 'node:fs/promises';

const BLOCK = 512;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function octal(value, width) {
  const encoded = value.toString(8).padStart(width - 1, '0');
  if (encoded.length !== width - 1) throw new Error('ustar field overflow');
  return `${encoded}\0`;
}

function staticExitProbe() {
  const output = Buffer.alloc(129);
  Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1]).copy(output);
  output.writeUInt16LE(2, 16);
  output.writeUInt16LE(62, 18);
  output.writeUInt32LE(1, 20);
  output.writeBigUInt64LE(0x400078n, 24);
  output.writeBigUInt64LE(64n, 32);
  output.writeUInt16LE(64, 52);
  output.writeUInt16LE(56, 54);
  output.writeUInt16LE(1, 56);
  output.writeUInt32LE(1, 64);
  output.writeUInt32LE(5, 68);
  output.writeBigUInt64LE(0n, 72);
  output.writeBigUInt64LE(0x400000n, 80);
  output.writeBigUInt64LE(0x400000n, 88);
  output.writeBigUInt64LE(BigInt(output.length), 96);
  output.writeBigUInt64LE(BigInt(output.length), 104);
  output.writeBigUInt64LE(0x1000n, 112);
  Buffer.from([0xb8, 0x3c, 0, 0, 0, 0x31, 0xff, 0x0f, 0x05]).copy(output, 120);
  return output;
}

function header(size) {
  const output = Buffer.alloc(BLOCK);
  output.write('probe', 0, 'ascii');
  output.write(octal(0o755, 8), 100, 'ascii');
  output.write(octal(0, 8), 108, 'ascii');
  output.write(octal(0, 8), 116, 'ascii');
  output.write(octal(size, 12), 124, 'ascii');
  output.write(octal(0, 12), 136, 'ascii');
  output.fill(0x20, 148, 156);
  output.write('0', 156, 'ascii');
  output.write('ustar\0', 257, 'ascii');
  output.write('00', 263, 'ascii');
  const checksum = output.reduce((sum, byte) => sum + byte, 0);
  output.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii');
  return output;
}

export function syntheticRootfsBytes() {
  const probe = staticExitProbe();
  const padded = Buffer.alloc(Math.ceil(probe.length / BLOCK) * BLOCK);
  probe.copy(padded);
  return Buffer.concat([header(probe.length), padded, Buffer.alloc(BLOCK * 2)]);
}

export async function createSyntheticRootfs(outputPath) {
  if (typeof outputPath !== 'string' || !outputPath.startsWith('/'))
    throw new TypeError('absolute synthetic output required');
  const bytes = syntheticRootfsBytes();
  let handle;
  let created = false;
  try {
    handle = await open(outputPath, 'wx', 0o600);
    created = true;
    await handle.writeFile(bytes);
    await handle.sync();
  } catch (error) {
    if (created) await unlink(outputPath).catch(() => undefined);
    throw error;
  } finally {
    await handle?.close();
  }
  return {
    schemaVersion: 1,
    archiveSha256: sha256(bytes),
    entrypoint: '/probe',
    platform: 'linux/amd64',
    size: bytes.length,
  };
}

if (import.meta.filename === process.argv[1]) {
  const [command, outputPath] = process.argv.slice(2);
  if (command !== 'create') throw new Error('unsupported synthetic command');
  createSyntheticRootfs(outputPath)
    .then((receipt) => process.stdout.write(`${JSON.stringify(receipt)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
