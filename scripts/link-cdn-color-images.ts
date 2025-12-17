import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { execSync } from 'child_process';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Parse CLI arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const BRAND_ARG = args.find(a => a.startsWith('--brand='));
const BRAND_FILTER = BRAND_ARG ? BRAND_ARG.split('=')[1] : null;

if (DRY_RUN) {
  console.log('🔍 DRY RUN MODE - No changes will be made to the database\n');
}

const CDN_URL_BASE = 'https://cdn.ogabassey.com/products/';
const CDN_HOST = 'bassey@82.29.190.219';
const CDN_PATH = '/var/www/cdn/products/';

// Known color keywords
const COLOR_KEYWORDS = [
  'black', 'white', 'silver', 'gold', 'blue', 'green', 'red', 'pink',
  'purple', 'gray', 'grey', 'graphite', 'navy', 'olive', 'teal',
  'midnight', 'starlight', 'space', 'titanium', 'ultramarine', 'coral',
  'mint', 'lavender', 'cream', 'yellow', 'orange', 'bronze', 'copper',
  'obsidian', 'porcelain', 'hazel', 'lemongrass', 'bay', 'peony', 'wintergreen',
  'phantom', 'aura', 'mystic', 'prism', 'burgundy', 'violet', 'lime',
  'rose', 'champagne', 'ice', 'sky', 'sand', 'natural', 'desert',
  'forest', 'ocean', 'sunrise', 'sunset', 'charcoal', 'onyx', 'pearl',
  'snow', 'cloudy', 'stormy', 'kinda',
];

const COMPOUND_PREFIXES = ['space', 'deep', 'rose', 'aura', 'mystic', 'phantom', 'prism', 'natural', 'desert', 'stormy', 'cloudy', 'kinda'];

function titleCase(str: string): string {
  return str.split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

function extractColorFromFilename(filename: string): string | null {
  // Remove extension
  const name = filename.replace(/\.(avif|webp|png|jpg|jpeg)$/i, '');
  const parts = name.split('-');

  // Search from end for color keywords
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].toLowerCase();
    if (COLOR_KEYWORDS.includes(part)) {
      // Check for compound colors
      if (i > 0 && COMPOUND_PREFIXES.includes(parts[i - 1].toLowerCase())) {
        return titleCase(parts[i - 1] + ' ' + parts[i]);
      }
      return titleCase(part);
    }
  }
  return null;
}

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // Remove parentheses content
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')
    .trim();
}

function extractProductNameFromFilename(filename: string): string {
  const name = filename.replace(/\.(avif|webp|png|jpg|jpeg)$/i, '');
  const parts = name.split('-');

  // Remove color from end
  const resultParts: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].toLowerCase();
    // Stop when we hit a color keyword (unless it's a compound prefix followed by non-color)
    if (COLOR_KEYWORDS.includes(part)) {
      // Check if this might be part of a compound color
      if (i < parts.length - 1 && COMPOUND_PREFIXES.includes(part)) {
        // It's a prefix - if next word is a color, stop here
        if (COLOR_KEYWORDS.includes(parts[i + 1].toLowerCase())) {
          break;
        }
      } else {
        break;
      }
    }
    resultParts.push(part);
  }

  return resultParts.join(' ');
}

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  images: string[] | null;
  color_images: Record<string, string[]> | null;
}

interface CDNImage {
  filename: string;
  url: string;
  color: string | null;
  productName: string;
}

async function getCDNImages(): Promise<CDNImage[]> {
  console.log('Fetching CDN image list...');

  try {
    const output = execSync(`ssh ${CDN_HOST} "ls ${CDN_PATH}"`, { encoding: 'utf-8' });
    const files = output.trim().split('\n').filter(f => f.endsWith('.avif') || f.endsWith('.webp'));

    console.log(`Found ${files.length} images on CDN\n`);

    return files.map(filename => ({
      filename,
      url: CDN_URL_BASE + filename,
      color: extractColorFromFilename(filename),
      productName: extractProductNameFromFilename(filename),
    }));
  } catch (error) {
    console.error('Failed to fetch CDN images:', error);
    process.exit(1);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('LINK CDN COLOR IMAGES TO PRODUCTS');
  console.log('='.repeat(60));
  console.log();

  // Get CDN images
  const cdnImages = await getCDNImages();

  // Filter to images with detectable colors
  const colorImages = cdnImages.filter(img => img.color !== null);
  console.log(`Images with detectable colors: ${colorImages.length}\n`);

  // Fetch all products
  console.log('Fetching products from database...');
  let allProducts: Product[] = [];
  let offset = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    let query = supabase
      .from('products')
      .select('id, name, slug, brand, images, color_images')
      .eq('status', 'active')
      .range(offset, offset + PAGE_SIZE - 1);

    if (BRAND_FILTER) {
      query = query.ilike('brand', BRAND_FILTER);
    }

    const { data: batch, error } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      process.exit(1);
    }

    if (!batch || batch.length === 0) break;
    allProducts = allProducts.concat(batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Total products: ${allProducts.length}\n`);

  // Build a map of normalized product names to products
  const productMap = new Map<string, Product[]>();
  for (const product of allProducts) {
    const normalized = normalizeProductName(product.name);
    if (!productMap.has(normalized)) {
      productMap.set(normalized, []);
    }
    productMap.get(normalized)!.push(product);
  }

  // Also map by slug
  const slugMap = new Map<string, Product>();
  for (const product of allProducts) {
    slugMap.set(product.slug, product);
  }

  // Match CDN images to products
  const matches: { product: Product; images: CDNImage[] }[] = [];
  const unmatched: CDNImage[] = [];

  // Group color images by product name
  const imagesByProduct = new Map<string, CDNImage[]>();
  for (const img of colorImages) {
    if (!imagesByProduct.has(img.productName)) {
      imagesByProduct.set(img.productName, []);
    }
    imagesByProduct.get(img.productName)!.push(img);
  }

  // Try to match each group to a product
  for (const [imgProductName, images] of imagesByProduct) {
    // Try exact match on normalized name
    let matchedProducts = productMap.get(imgProductName);

    // Try partial match if no exact match
    if (!matchedProducts || matchedProducts.length === 0) {
      // Try finding products whose normalized name contains the image product name
      for (const [normalizedName, products] of productMap) {
        if (normalizedName.includes(imgProductName) || imgProductName.includes(normalizedName)) {
          matchedProducts = products;
          break;
        }
      }
    }

    if (matchedProducts && matchedProducts.length > 0) {
      // Match to all products with this name (could be different storage variants)
      for (const product of matchedProducts) {
        matches.push({ product, images });
      }
    } else {
      unmatched.push(...images);
    }
  }

  console.log(`Matched image groups: ${matches.length}`);
  console.log(`Unmatched images: ${unmatched.length}\n`);

  // Process matches - update color_images
  let updated = 0;
  let skipped = 0;
  const results: { product: Product; newColors: string[]; addedImages: number }[] = [];

  for (const match of matches) {
    const { product, images } = match;

    // Build new color_images
    const existingColorImages = product.color_images || {};
    const newColorImages = { ...existingColorImages };
    let addedImages = 0;

    for (const img of images) {
      if (!img.color) continue;

      if (!newColorImages[img.color]) {
        newColorImages[img.color] = [];
      }

      // Add image if not already present
      if (!newColorImages[img.color].includes(img.url)) {
        newColorImages[img.color].push(img.url);
        addedImages++;
      }
    }

    // Check if anything changed
    if (addedImages === 0) {
      skipped++;
      continue;
    }

    const newColors = Object.keys(newColorImages).filter(c => !existingColorImages[c]);

    if (VERBOSE) {
      console.log(`\n${product.name}`);
      console.log(`  New colors: ${newColors.join(', ') || '(none)'}`);
      console.log(`  Added images: ${addedImages}`);
    }

    if (!DRY_RUN) {
      // Also ensure images array includes all color images
      const allImageUrls = new Set(product.images || []);
      for (const urls of Object.values(newColorImages)) {
        for (const url of urls) {
          allImageUrls.add(url);
        }
      }

      const { error } = await supabase
        .from('products')
        .update({
          color_images: newColorImages,
          images: Array.from(allImageUrls),
        })
        .eq('id', product.id);

      if (error) {
        console.error(`Failed to update ${product.name}: ${error.message}`);
      } else {
        updated++;
        results.push({ product, newColors, addedImages });
        if (!VERBOSE) {
          process.stdout.write(`\rUpdated: ${updated}`);
        }
      }
    } else {
      results.push({ product, newColors, addedImages });
      updated++;
    }
  }

  console.log('\n');

  // Generate report
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Products updated: ${updated}`);
  console.log(`Products skipped (no new images): ${skipped}`);
  console.log(`Unmatched CDN images: ${unmatched.length}`);

  // Save report
  const report = generateReport(results, unmatched, DRY_RUN);
  const reportFile = DRY_RUN ? 'CDN_COLOR_LINK_DRY_RUN.md' : 'CDN_COLOR_LINK_REPORT.md';
  fs.writeFileSync(reportFile, report);
  console.log(`\n✅ Report saved to ${reportFile}`);

  if (DRY_RUN) {
    console.log('\nRun without --dry-run to apply changes');
  }
}

function generateReport(
  results: { product: Product; newColors: string[]; addedImages: number }[],
  unmatched: CDNImage[],
  dryRun: boolean
): string {
  let report = `# CDN Color Images Link Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Mode:** ${dryRun ? 'DRY RUN' : 'LIVE'}\n\n`;

  report += `## Summary\n\n`;
  report += `| Metric | Count |\n`;
  report += `|--------|-------|\n`;
  report += `| Products updated | ${results.length} |\n`;
  report += `| Total images linked | ${results.reduce((sum, r) => sum + r.addedImages, 0)} |\n`;
  report += `| Unmatched CDN images | ${unmatched.length} |\n\n`;

  // Group by brand
  const byBrand: Record<string, typeof results> = {};
  for (const result of results) {
    const brand = result.product.brand || 'Unknown';
    if (!byBrand[brand]) byBrand[brand] = [];
    byBrand[brand].push(result);
  }

  report += `## Updates by Brand\n\n`;
  report += `| Brand | Products | New Colors |\n`;
  report += `|-------|----------|------------|\n`;

  for (const [brand, brandResults] of Object.entries(byBrand).sort((a, b) => b[1].length - a[1].length)) {
    const allNewColors = new Set<string>();
    brandResults.forEach(r => r.newColors.forEach(c => allNewColors.add(c)));
    report += `| ${brand} | ${brandResults.length} | ${Array.from(allNewColors).slice(0, 5).join(', ')} |\n`;
  }

  if (dryRun && results.length > 0) {
    report += `\n## Sample Updates (First 20)\n\n`;
    for (const result of results.slice(0, 20)) {
      report += `### ${result.product.name}\n\n`;
      report += `- **Brand:** ${result.product.brand || 'N/A'}\n`;
      report += `- **New colors:** ${result.newColors.join(', ') || '(existing colors updated)'}\n`;
      report += `- **Images added:** ${result.addedImages}\n\n`;
    }
  }

  if (unmatched.length > 0) {
    report += `\n## Unmatched CDN Images (Sample)\n\n`;
    report += `These images exist on CDN but couldn't be matched to products:\n\n`;
    for (const img of unmatched.slice(0, 50)) {
      report += `- ${img.filename} (color: ${img.color || 'unknown'})\n`;
    }
    if (unmatched.length > 50) {
      report += `\n... and ${unmatched.length - 50} more\n`;
    }
  }

  return report;
}

main().catch(console.error);
