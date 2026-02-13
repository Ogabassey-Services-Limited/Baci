/**
 * QR Code Generator Utility
 * Generates QR codes as base64 SVG data URIs for embedding in HTML templates.
 * Used primarily for receipt/invoice PDFs (payment links, tracking URLs).
 */

import QRCode from 'qrcode';

/**
 * Generates a QR code as a base64-encoded SVG data URI.
 * Suitable for embedding directly in `<img src="...">` tags within HTML templates.
 *
 * @param url - The URL or text to encode in the QR code
 * @param size - The width/height of the QR code in pixels (default: 150)
 * @returns A data URI string: `data:image/svg+xml;base64,...`
 */
export async function generateQrDataUri(
  url: string,
  size = 150
): Promise<string> {
  const svgString = await QRCode.toString(url, {
    type: 'svg',
    width: size,
    margin: 1,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });

  // Base64 encode for safe embedding in HTML img tags
  const base64 = btoa(svgString);
  return `data:image/svg+xml;base64,${base64}`;
}
