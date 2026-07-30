import { open, readFile } from 'node:fs/promises';

export async function readRecoverableBootstrapJournal(path) {
  const source = await readFile(path);
  const lastNewline = source.lastIndexOf(0x0a);
  const committedLength = lastNewline < 0 ? 0 : lastNewline + 1;
  if (committedLength === source.length) return source.toString('utf8');
  const handle = await open(path, 'r+');
  try {
    const current = await handle.readFile();
    if (!source.equals(current))
      throw new TypeError('bootstrap journal changed during recovery');
    await handle.truncate(committedLength);
    await handle.sync();
  } finally {
    await handle.close();
  }
  return source.subarray(0, committedLength).toString('utf8');
}
