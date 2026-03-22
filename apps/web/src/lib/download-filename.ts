function normalizeFilenameToken(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split('')
    .map((character) => {
      const charCode = character.charCodeAt(0);
      return charCode < 0x20 || charCode === 0x7f ? ' ' : character;
    })
    .join('')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/[^A-Za-z0-9._ -]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-. ]+|[-. ]+$/g, '')
    .slice(0, 80);
}

function normalizeUtf8FilenameToken(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFC')
    .split('')
    .map((character) => {
      const charCode = character.charCodeAt(0);
      return charCode < 0x20 || charCode === 0x7f ? ' ' : character;
    })
    .join('')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-. ]+|[-. ]+$/g, '')
    .slice(0, 80);
}

export function sanitizeDownloadFilenamePart(
  value: string | null | undefined,
  fallback: string
) {
  return (
    normalizeFilenameToken(value) ||
    normalizeFilenameToken(fallback) ||
    'download'
  );
}

export function buildPdfContentDisposition(
  prefix: string,
  orderNumber: string | null | undefined
) {
  const safePrefix = sanitizeDownloadFilenamePart(prefix, 'document');
  const safeOrderNumber = sanitizeDownloadFilenamePart(orderNumber, 'order');
  const utf8OrderNumber =
    normalizeUtf8FilenameToken(orderNumber) || safeOrderNumber;
  const filename = `${safePrefix}-${safeOrderNumber}.pdf`;
  const utf8Filename = `${safePrefix}-${utf8OrderNumber}.pdf`;

  return `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(utf8Filename)}`;
}
