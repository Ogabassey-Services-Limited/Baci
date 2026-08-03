import { isAbsolute } from 'node:path';
import { REVIEWED_EVIDENCE_SYSTEM_PATH } from './cloudflare-evidence-qualification-cli';

const READ_REVOCATION_RECEIPT_PATH =
  'EVIDENCE_READ_TOKEN_REVOCATION_READBACK_RECEIPT_PATH';

/** Builds the allowlisted, credentialless environment for receipt recovery. */
export function prepareReadTokenRevocationProcessEnvironment(
  inherited: Readonly<Record<string, string | undefined>>
) {
  if (
    inherited.CLOUDFLARE_WRITE_TOKEN !== undefined ||
    inherited.CLOUDFLARE_READ_TOKEN !== undefined
  )
    throw new Error(
      'read-token revocation recovery must not receive a Cloudflare credential'
    );
  const receiptPath = inherited[READ_REVOCATION_RECEIPT_PATH];
  if (!receiptPath || !isAbsolute(receiptPath))
    throw new Error(
      `${READ_REVOCATION_RECEIPT_PATH} must be absolute for read-token recovery`
    );
  const environment: Record<string, string> = {
    PATH: REVIEWED_EVIDENCE_SYSTEM_PATH,
    [READ_REVOCATION_RECEIPT_PATH]: receiptPath,
  };
  if (inherited.TMPDIR) environment.TMPDIR = inherited.TMPDIR;
  return environment;
}
