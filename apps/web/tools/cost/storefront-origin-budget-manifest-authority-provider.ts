import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { type FileHandle, open } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

const HASH = /^[a-f0-9]{64}$/;
const RECEIPT_KEYS = [
  'authorityReceiptSha256',
  'manifestSha256',
  'source',
  'verifiedAt',
] as const;

function parseReceipt(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('production manifest authority receipt is invalid');
  const receipt = value as Record<string, unknown>;
  if (
    Object.keys(receipt).sort().join('\0') !==
      [...RECEIPT_KEYS].sort().join('\0') ||
    !['provider_signed', 'audit_verified'].includes(String(receipt.source)) ||
    !HASH.test(String(receipt.manifestSha256)) ||
    !HASH.test(String(receipt.authorityReceiptSha256)) ||
    !Number.isFinite(Date.parse(String(receipt.verifiedAt)))
  )
    throw new Error('production manifest authority receipt is invalid');
  return {
    source: receipt.source as 'provider_signed' | 'audit_verified',
    manifestSha256: String(receipt.manifestSha256),
    authorityReceiptSha256: String(receipt.authorityReceiptSha256),
    verifiedAt: String(receipt.verifiedAt),
  };
}

/** Reads one independently produced private provider/audit receipt. */
export async function resolveStorefrontDeliveryManifestAuthority() {
  const path = process.env.STOREFRONT_MANIFEST_AUTHORITY_RECEIPT_PATH;
  const expectedSha256 =
    process.env.STOREFRONT_MANIFEST_AUTHORITY_RECEIPT_FILE_SHA256;
  if (
    !path ||
    !isAbsolute(path) ||
    !expectedSha256 ||
    !HASH.test(expectedSha256)
  )
    throw new Error('production manifest authority receipt is required');
  let handle: FileHandle | undefined;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600)
      throw new Error('production manifest authority receipt is not private');
    const bytes = await handle.readFile();
    if (createHash('sha256').update(bytes).digest('hex') !== expectedSha256)
      throw new Error('production manifest authority receipt hash mismatches');
    return parseReceipt(JSON.parse(bytes.toString('utf8')));
  } finally {
    await handle?.close().catch(() => undefined);
  }
}
