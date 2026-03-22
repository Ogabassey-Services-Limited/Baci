import { describe, expect, it } from 'vitest';
import {
  buildPdfContentDisposition,
  sanitizeDownloadFilenamePart,
} from '@/lib/download-filename';

describe('sanitizeDownloadFilenamePart', () => {
  it('preserves safe tokens', () => {
    expect(sanitizeDownloadFilenamePart('ORD-1001', 'order')).toBe('ORD-1001');
  });

  it('strips control characters and reserved filename characters', () => {
    expect(
      sanitizeDownloadFilenamePart(
        ' ORD-1001\r\nSet-Cookie: bad/file ',
        'order'
      )
    ).toBe('ORD-1001-Set-Cookie-bad-file');
  });

  it('falls back when the value becomes empty', () => {
    expect(sanitizeDownloadFilenamePart('***', 'order')).toBe('order');
  });
});

describe('buildPdfContentDisposition', () => {
  it('returns an attachment header with ascii and RFC5987 filenames', () => {
    expect(buildPdfContentDisposition('invoice', 'ORD-1001')).toBe(
      `attachment; filename="invoice-ORD-1001.pdf"; filename*=UTF-8''invoice-ORD-1001.pdf`
    );
  });

  it('sanitizes unsafe order numbers before building the header', () => {
    const header = buildPdfContentDisposition(
      'receipt',
      'ORD-1001\r\nSet-Cookie: evil'
    );

    expect(header).toContain('receipt-ORD-1001-Set-Cookie-evil.pdf');
    expect(header).not.toContain('\r');
    expect(header).not.toContain('\n');
  });

  it('keeps an ASCII fallback and RFC5987-encoded unicode filename', () => {
    const header = buildPdfContentDisposition('receipt', 'résumé 注文-№123');

    expect(header).toContain('filename="receipt-resume-No123.pdf"');
    expect(header).toContain(
      "filename*=UTF-8''receipt-r%C3%A9sum%C3%A9-%E6%B3%A8%E6%96%87-%E2%84%96123.pdf"
    );
    expect(header).not.toContain('\r');
    expect(header).not.toContain('\n');
  });

  it('encodes parentheses while preserving apostrophes in filename*', () => {
    const header = buildPdfContentDisposition('receipt', "Kid's Order (VIP)");

    expect(header).toContain('filename="receipt-Kid-s-Order-VIP.pdf"');
    expect(header).toContain(
      "filename*=UTF-8''receipt-Kid's-Order-%28VIP%29.pdf"
    );
  });
});
