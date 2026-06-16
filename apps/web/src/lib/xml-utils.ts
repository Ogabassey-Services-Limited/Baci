export function escapeXml(value: unknown): string {
  if (value == null) {
    return '';
  }

  let stringValue: string;
  try {
    stringValue = String(value);
  } catch {
    stringValue = Object.prototype.toString.call(value);
  }

  return stringValue
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
