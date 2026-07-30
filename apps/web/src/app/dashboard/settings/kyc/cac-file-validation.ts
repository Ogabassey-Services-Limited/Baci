const MAX_CAC_FILE_SIZE = 5 * 1024 * 1024;
const CAC_ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export const CAC_ACCEPTED_FILE_TYPES =
  'image/jpeg,image/png,image/webp,application/pdf';

export function validateCacCertificateFile(
  file: File
): { kind: 'valid' } | { kind: 'invalid-type' } | { kind: 'too-large' } {
  if (!CAC_ACCEPTED_MIME_TYPES.has(file.type)) return { kind: 'invalid-type' };
  if (file.size > MAX_CAC_FILE_SIZE) return { kind: 'too-large' };
  return { kind: 'valid' };
}
