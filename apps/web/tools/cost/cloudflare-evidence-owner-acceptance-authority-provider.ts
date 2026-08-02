import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { type FileHandle, open } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

const sha256 = /^[a-f0-9]{64}$/;

/** Reads the independently issued, hash-pinned owner acceptance receipt. */
export async function resolveOwnerAcceptanceAuthority() {
  const path = process.env.EVIDENCE_OWNER_ACCEPTANCE_AUTHORITY_RECEIPT_PATH;
  const expectedSha256 =
    process.env.EVIDENCE_OWNER_ACCEPTANCE_AUTHORITY_RECEIPT_FILE_SHA256;
  if (
    !path ||
    !isAbsolute(path) ||
    !expectedSha256 ||
    !sha256.test(expectedSha256)
  )
    throw new Error('owner acceptance authority receipt is required');
  let handle: FileHandle | undefined;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600)
      throw new Error('owner acceptance authority receipt is not private');
    const bytes = await handle.readFile();
    if (createHash('sha256').update(bytes).digest('hex') !== expectedSha256)
      throw new Error('owner acceptance authority receipt hash mismatches');
    return JSON.parse(bytes.toString('utf8'));
  } finally {
    await handle?.close().catch(() => undefined);
  }
}
