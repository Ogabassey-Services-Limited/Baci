const CAC_FILE_SIGNATURES: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
};

export function hasCacFileSignature(
  buffer: Uint8Array,
  mimeType: string
): boolean {
  if (mimeType === 'image/webp') {
    return (
      matchesSignature(buffer, [0x52, 0x49, 0x46, 0x46]) &&
      matchesSignature(buffer, [0x57, 0x45, 0x42, 0x50], 8)
    );
  }

  const signatures = CAC_FILE_SIGNATURES[mimeType];
  return signatures ? matchesSignature(buffer, signatures) : false;
}

function matchesSignature(
  buffer: Uint8Array,
  signature: number[],
  offset = 0
): boolean {
  return signature.every((byte, index) => buffer[offset + index] === byte);
}
