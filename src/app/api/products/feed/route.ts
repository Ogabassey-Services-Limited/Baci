
import { NextResponse } from 'next/server';
import { products } from '@/lib/products';

// Helper function to escape XML characters
const escapeXml = (unsafe: string | number) => {
    if (typeof unsafe !== 'string') {
        return unsafe;
    }
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case "'": return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};

export async function GET() {
  const storeUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:9002';

  const xmlItems = products
    .filter(p => p.status === 'active') // Only include active products
    .map(product => `
      <item>
        <g:id>${escapeXml(product.id)}</g:id>
        <g:title>${escapeXml(product.name)}</g:title>
        <g:description>${escapeXml(product.description)}</g:description>
        <g:link>${storeUrl}/product/${product.id}</g:link>
        <g:image_link>${escapeXml(product.imageLarge)}</g:image_link>
        <g:availability>${product.stock > 0 ? 'in stock' : 'out of stock'}</g:availability>
        <g:price>${escapeXml(product.price.toFixed(2))} USD</g:price>
        <g:brand>${escapeXml(product.brand)}</g:brand>
        <g:gtin>${escapeXml(product.gtin)}</g:gtin>
        <g:mpn>${escapeXml(product.mpn)}</g:mpn>
      </item>
    `).join('');

  const xmlFeed = `
    <rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
      <channel>
        <title>Baci Store Product Feed</title>
        <link>${storeUrl}</link>
        <description>Product feed for Baci Store</description>
        ${xmlItems}
      </channel>
    </rss>
  `.trim();

  return new NextResponse(xmlFeed, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
