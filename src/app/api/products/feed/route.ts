import { NextResponse } from 'next/server';

// Mock product data - in a real app, this would come from your database
const products = [
    {
        id: 'p1',
        name: 'Ceramic Mug Set',
        description: 'A beautiful set of two handmade ceramic mugs, perfect for your morning coffee.',
        status: 'active',
        price: 49.99,
        stock: 120,
        image: 'https://picsum.photos/seed/p1/600/400',
        brand: 'Baci Artisan',
        gtin: '123456789012',
        mpn: 'CM-SET-01'
    },
    {
        id: 'p2',
        name: 'Minimalist Desk Lamp',
        description: 'A sleek and modern desk lamp with adjustable brightness. Fits any workspace.',
        status: 'active',
        price: 79.99,
        stock: 75,
        image: 'https://picsum.photos/seed/p2/600/400',
        brand: 'Baci Lighting',
        gtin: '123456789013',
        mpn: 'DL-MIN-02'
    },
    {
        id: 'p3',
        name: 'Organic Cotton Towels',
        description: 'Set of 3 soft and absorbent towels made from 100% organic cotton.',
        status: 'archived',
        price: 35.00,
        stock: 0,
        image: 'https://picsum.photos/seed/p3/600/400',
        brand: 'Baci Home',
        gtin: '123456789014',
        mpn: 'TOW-ORG-03'
    },
    {
        id: 'p4',
        name: 'Smart Water Bottle',
        description: 'A water bottle that tracks your intake and reminds you to stay hydrated.',
        status: 'draft',
        price: 89.99,
        stock: 30,
        image: 'https://picsum.photos/seed/p4/600/400',
        brand: 'Baci Tech',
        gtin: '123456789015',
        mpn: 'SWB-04'
    },
    {
        id: 'p5',
        name: 'Leather Journal',
        description: 'A premium leather-bound journal for your thoughts, dreams, and sketches.',
        status: 'active',
        price: 25.00,
        stock: 200,
        image: 'https://picsum.photos/seed/p5/600/400',
        brand: 'Baci Stationary',
        gtin: '123456789016',
        mpn: 'JRN-LTH-05'
    },
];

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
        <g:image_link>${escapeXml(product.image)}</g:image_link>
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
