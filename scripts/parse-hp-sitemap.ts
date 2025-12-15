import fs from 'fs';

// Load the HP PDP sitemap
const sitemapXml = fs.readFileSync('hp_pdp_sitemap.xml', 'utf-8');

// Parse URL blocks: <url>...</url>
const urlBlocks = sitemapXml.match(/<url>[\s\S]*?<\/url>/g) || [];
console.log(`Found ${urlBlocks.length} product entries in HP sitemap`);

interface ProductImageMap {
    productUrl: string;
    productSlug: string;
    images: string[];
}

const products: ProductImageMap[] = [];

for (const block of urlBlocks) {
    // Extract product URL
    const locMatch = block.match(/<loc>(.*?)<\/loc>/);
    if (!locMatch) continue;

    const productUrl = locMatch[1];

    // Extract slug from URL (last part after /pdp/)
    const slugMatch = productUrl.match(/\/pdp\/(.+)$/);
    if (!slugMatch) continue;

    const productSlug = slugMatch[1];

    // Extract all image URLs (prefer large versions w=573 or higher)
    const imageMatches = block.match(/<image:loc>(.*?)<\/image:loc>/g) || [];
    const images = imageMatches.map(m => {
        const url = m.replace('<image:loc>', '').replace('</image:loc>', '');
        return url.replace(/&amp;/g, '&'); // Decode XML entities
    });

    // Filter for best quality images (widen.net with w=573 or higher)
    // Use URL parsing to validate the host properly
    const bestImages = images.filter(img => {
        try {
            const url = new URL(img);
            return url.hostname === 'hp.widen.net' &&
                (img.includes('w=573') || img.includes('w=800') || img.includes('w=1500') || img.includes('w=1659'));
        } catch {
            return false;
        }
    });

    if (bestImages.length > 0) {
        products.push({
            productUrl,
            productSlug,
            images: bestImages
        });
    }
}

console.log(`\nExtracted ${products.length} products with high-quality Widen images`);

// Save full mapping
fs.writeFileSync('hp_sitemap_images.json', JSON.stringify(products, null, 2));

// Filter for EliteBook/ProBook/Victus laptops
const laptopKeywords = ['elitebook', 'probook', 'victus', 'zbook', 'envy', 'spectre', 'pavilion', 'omen'];
const laptops = products.filter(p =>
    laptopKeywords.some(kw => p.productSlug.toLowerCase().includes(kw))
);

console.log(`\n🎯 Found ${laptops.length} HP Laptops with official images!`);
fs.writeFileSync('hp_laptop_images.json', JSON.stringify(laptops, null, 2));

// Show first 10
console.log('\nFirst 10 Laptops:');
laptops.slice(0, 10).forEach(l => {
    console.log(`- ${l.productSlug}`);
    console.log(`  Image: ${l.images[0]}`);
});
