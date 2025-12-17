import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Known color keywords to detect in filenames
const COLOR_KEYWORDS = [
  // Basic colors
  'black', 'white', 'silver', 'gold', 'blue', 'green', 'red', 'pink',
  'purple', 'gray', 'grey', 'graphite', 'navy', 'olive', 'teal',
  // Apple/Premium colors
  'midnight', 'starlight', 'space', 'titanium', 'ultramarine', 'coral',
  'mint', 'lavender', 'cream', 'yellow', 'orange', 'bronze', 'copper',
  // Google Pixel colors
  'obsidian', 'porcelain', 'hazel', 'lemongrass', 'bay', 'peony', 'wintergreen',
  // Samsung colors
  'phantom', 'aura', 'mystic', 'prism', 'burgundy', 'violet', 'lime',
  // Other common colors
  'rose', 'champagne', 'ice', 'sky', 'sand', 'natural', 'desert',
  'forest', 'ocean', 'sunrise', 'sunset', 'charcoal', 'onyx', 'pearl',
];

// Compound color prefixes
const COMPOUND_PREFIXES = ['space', 'deep', 'rose', 'aura', 'mystic', 'phantom', 'prism', 'natural', 'desert'];

function titleCase(str: string): string {
  return str.split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

function extractColorFromUrl(url: string): string | null {
  // Extract filename without extension
  const filename = url.split('/').pop()?.replace(/\.(avif|webp|png|jpg|jpeg)$/i, '') || '';
  const parts = filename.split('-');

  // Search from end of filename for color keywords
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].toLowerCase();
    if (COLOR_KEYWORDS.includes(part)) {
      // Check for compound colors like "space-black", "deep-purple"
      if (i > 0 && COMPOUND_PREFIXES.includes(parts[i - 1].toLowerCase())) {
        return titleCase(parts[i - 1] + ' ' + parts[i]);
      }
      return titleCase(part);
    }
  }
  return null;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  images: string[] | null;
  color_images: Record<string, string[]> | null;
  category_slug?: string;
}

interface AuditResult {
  totalProducts: number;
  productsWithColorImages: number;
  productsWithoutColorImages: number;
  productsWithDetectableColors: number;
  byBrand: Record<string, {
    total: number;
    withColorImages: number;
    withDetectableColors: number;
    detectedColors: Set<string>;
  }>;
  samples: {
    hasColorImagesButEmpty: Product[];
    hasDetectableColorsInImages: { product: Product; detectedColors: string[] }[];
    noColorsDetectable: Product[];
  };
}

async function runAudit(): Promise<AuditResult> {
  console.log('🔍 Auditing product color images...\n');

  // Fetch all active products with pagination
  let allProducts: Product[] = [];
  let offset = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data: batch, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        brand,
        images,
        color_images,
        categories!inner(slug)
      `)
      .eq('status', 'active')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching products:', error);
      process.exit(1);
    }

    if (!batch || batch.length === 0) break;

    allProducts = allProducts.concat(batch.map((p: any) => ({
      ...p,
      category_slug: p.categories?.slug,
    })));

    console.log(`  Fetched ${allProducts.length} products...`);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`\nTotal products: ${allProducts.length}\n`);

  const result: AuditResult = {
    totalProducts: allProducts.length,
    productsWithColorImages: 0,
    productsWithoutColorImages: 0,
    productsWithDetectableColors: 0,
    byBrand: {},
    samples: {
      hasColorImagesButEmpty: [],
      hasDetectableColorsInImages: [],
      noColorsDetectable: [],
    },
  };

  for (const product of allProducts) {
    const brand = product.brand || 'Unknown';

    // Initialize brand stats
    if (!result.byBrand[brand]) {
      result.byBrand[brand] = {
        total: 0,
        withColorImages: 0,
        withDetectableColors: 0,
        detectedColors: new Set(),
      };
    }
    result.byBrand[brand].total++;

    // Check if product has color_images populated
    const hasColorImages = product.color_images && Object.keys(product.color_images).length > 0;

    if (hasColorImages) {
      result.productsWithColorImages++;
      result.byBrand[brand].withColorImages++;
    } else {
      result.productsWithoutColorImages++;

      // Check if colors can be detected from images array
      const images = product.images || [];
      const detectedColors: string[] = [];

      for (const imageUrl of images) {
        const color = extractColorFromUrl(imageUrl);
        if (color && !detectedColors.includes(color)) {
          detectedColors.push(color);
          result.byBrand[brand].detectedColors.add(color);
        }
      }

      if (detectedColors.length > 0) {
        result.productsWithDetectableColors++;
        result.byBrand[brand].withDetectableColors++;

        // Store sample
        if (result.samples.hasDetectableColorsInImages.length < 20) {
          result.samples.hasDetectableColorsInImages.push({
            product,
            detectedColors,
          });
        }
      } else if (images.length > 1) {
        // Has multiple images but no detectable colors
        if (result.samples.noColorsDetectable.length < 10) {
          result.samples.noColorsDetectable.push(product);
        }
      }
    }
  }

  return result;
}

function generateReport(result: AuditResult): string {
  let report = `# Color Images Audit Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;

  report += `## Summary\n\n`;
  report += `| Metric | Count |\n`;
  report += `|--------|-------|\n`;
  report += `| Total Active Products | ${result.totalProducts} |\n`;
  report += `| Products WITH color_images | ${result.productsWithColorImages} |\n`;
  report += `| Products WITHOUT color_images | ${result.productsWithoutColorImages} |\n`;
  report += `| Products with DETECTABLE colors | ${result.productsWithDetectableColors} |\n\n`;

  report += `## Breakdown by Brand\n\n`;
  report += `| Brand | Total | Has color_images | Detectable Colors | Sample Colors |\n`;
  report += `|-------|-------|------------------|-------------------|---------------|\n`;

  // Sort brands by detectable colors (highest first)
  const sortedBrands = Object.entries(result.byBrand)
    .sort((a, b) => b[1].withDetectableColors - a[1].withDetectableColors);

  for (const [brand, stats] of sortedBrands) {
    const sampleColors = Array.from(stats.detectedColors).slice(0, 5).join(', ');
    report += `| ${brand} | ${stats.total} | ${stats.withColorImages} | ${stats.withDetectableColors} | ${sampleColors} |\n`;
  }

  report += `\n## Products with Detectable Colors (Samples)\n\n`;
  report += `These products have color names in their image URLs that can be automatically extracted.\n\n`;

  for (const sample of result.samples.hasDetectableColorsInImages) {
    report += `### ${sample.product.name}\n\n`;
    report += `- **Brand:** ${sample.product.brand || 'N/A'}\n`;
    report += `- **Detected Colors:** ${sample.detectedColors.join(', ')}\n`;
    report += `- **Images:**\n`;
    for (const img of sample.product.images || []) {
      report += `  - ${img}\n`;
    }
    report += `\n`;
  }

  if (result.samples.noColorsDetectable.length > 0) {
    report += `## Products with Multiple Images but No Detectable Colors\n\n`;
    report += `These products have multiple images but the color cannot be detected from filenames.\n\n`;

    for (const product of result.samples.noColorsDetectable) {
      report += `- **${product.name}** (${product.brand || 'N/A'})\n`;
      for (const img of product.images || []) {
        report += `  - ${img}\n`;
      }
    }
  }

  return report;
}

async function main() {
  console.log('='.repeat(60));
  console.log('COLOR IMAGES AUDIT');
  console.log('='.repeat(60));
  console.log();

  const result = await runAudit();
  const report = generateReport(result);

  // Save report
  const reportFile = 'COLOR_IMAGES_AUDIT.md';
  fs.writeFileSync(reportFile, report);
  console.log(`\n✅ Report saved to ${reportFile}`);

  // Save JSON for programmatic use
  const jsonFile = 'COLOR_IMAGES_AUDIT.json';
  fs.writeFileSync(jsonFile, JSON.stringify({
    generated: new Date().toISOString(),
    summary: {
      totalProducts: result.totalProducts,
      productsWithColorImages: result.productsWithColorImages,
      productsWithoutColorImages: result.productsWithoutColorImages,
      productsWithDetectableColors: result.productsWithDetectableColors,
    },
    byBrand: Object.fromEntries(
      Object.entries(result.byBrand).map(([brand, stats]) => [
        brand,
        {
          ...stats,
          detectedColors: Array.from(stats.detectedColors),
        },
      ])
    ),
  }, null, 2));
  console.log(`✅ JSON data saved to ${jsonFile}`);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Products: ${result.totalProducts}`);
  console.log(`With color_images: ${result.productsWithColorImages}`);
  console.log(`Without color_images: ${result.productsWithoutColorImages}`);
  console.log(`Detectable colors in images: ${result.productsWithDetectableColors}`);
  console.log();
  console.log('Top brands with detectable colors:');

  const sortedBrands = Object.entries(result.byBrand)
    .filter(([, stats]) => stats.withDetectableColors > 0)
    .sort((a, b) => b[1].withDetectableColors - a[1].withDetectableColors)
    .slice(0, 10);

  for (const [brand, stats] of sortedBrands) {
    console.log(`  ${brand}: ${stats.withDetectableColors} products`);
  }
}

main().catch(console.error);
