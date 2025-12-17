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

// Parse CLI arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const BRAND_ARG = args.find(a => a.startsWith('--brand='));
const BRAND_FILTER = BRAND_ARG ? BRAND_ARG.split('=')[1] : null;
const LIMIT_ARG = args.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 0;

if (DRY_RUN) {
  console.log('🔍 DRY RUN MODE - No changes will be made to the database\n');
}

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

// Compound color prefixes that combine with the next word
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
}

interface PopulateResult {
  productId: string;
  productName: string;
  brand: string;
  success: boolean;
  colorImages?: Record<string, string[]>;
  error?: string;
}

async function populateColorImages(): Promise<PopulateResult[]> {
  console.log('='.repeat(60));
  console.log('POPULATE COLOR IMAGES');
  console.log('='.repeat(60));
  console.log();

  // Fetch all products without color_images (or with empty color_images)
  console.log('Fetching products without color_images...\n');

  let allProducts: Product[] = [];
  let offset = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    let query = supabase
      .from('products')
      .select('id, name, slug, brand, images, color_images')
      .eq('status', 'active')
      .order('brand')
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

    // Filter to products without color_images or with empty color_images
    const filtered = batch.filter((p: Product) => {
      // Must have images array with at least one item
      if (!p.images || p.images.length === 0) return false;
      // Must not have color_images populated
      if (p.color_images && Object.keys(p.color_images).length > 0) return false;
      return true;
    });

    allProducts = allProducts.concat(filtered);
    console.log(`  Fetched batch: ${batch.length} total, ${filtered.length} need color_images...`);

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`\nProducts to process: ${allProducts.length}\n`);

  if (LIMIT > 0) {
    allProducts = allProducts.slice(0, LIMIT);
    console.log(`Limited to first ${LIMIT} products\n`);
  }

  const results: PopulateResult[] = [];
  let updated = 0;
  let skipped = 0;

  for (const product of allProducts) {
    const colorImages: Record<string, string[]> = {};

    // Extract colors from each image URL
    for (const imageUrl of product.images || []) {
      const color = extractColorFromUrl(imageUrl);
      if (color) {
        if (!colorImages[color]) {
          colorImages[color] = [];
        }
        colorImages[color].push(imageUrl);
      }
    }

    // Only update if we detected at least one color
    if (Object.keys(colorImages).length > 0) {
      if (VERBOSE) {
        console.log(`\n${product.name} (${product.brand || 'N/A'})`);
        console.log(`  Detected colors: ${Object.keys(colorImages).join(', ')}`);
      }

      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ color_images: colorImages })
          .eq('id', product.id);

        if (updateError) {
          results.push({
            productId: product.id,
            productName: product.name,
            brand: product.brand || 'Unknown',
            success: false,
            error: updateError.message,
          });
          console.error(`  ❌ Failed to update: ${updateError.message}`);
        } else {
          results.push({
            productId: product.id,
            productName: product.name,
            brand: product.brand || 'Unknown',
            success: true,
            colorImages,
          });
          updated++;
          if (!VERBOSE) {
            process.stdout.write(`\rUpdated: ${updated} / ${allProducts.length}`);
          }
        }
      } else {
        // Dry run - just record what would happen
        results.push({
          productId: product.id,
          productName: product.name,
          brand: product.brand || 'Unknown',
          success: true,
          colorImages,
        });
        updated++;
      }
    } else {
      skipped++;
      if (VERBOSE) {
        console.log(`\n${product.name} - No colors detected, skipping`);
      }
    }
  }

  console.log('\n');

  return results;
}

function generateReport(results: PopulateResult[], dryRun: boolean): string {
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  // Group by brand
  const byBrand: Record<string, PopulateResult[]> = {};
  for (const result of results) {
    if (!byBrand[result.brand]) {
      byBrand[result.brand] = [];
    }
    byBrand[result.brand].push(result);
  }

  // Collect unique colors per brand
  const colorsByBrand: Record<string, Set<string>> = {};
  for (const result of results) {
    if (result.colorImages) {
      if (!colorsByBrand[result.brand]) {
        colorsByBrand[result.brand] = new Set();
      }
      for (const color of Object.keys(result.colorImages)) {
        colorsByBrand[result.brand].add(color);
      }
    }
  }

  let report = `# Color Images Population Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Mode:** ${dryRun ? 'DRY RUN (no changes made)' : 'LIVE'}\n\n`;

  report += `## Summary\n\n`;
  report += `| Metric | Count |\n`;
  report += `|--------|-------|\n`;
  report += `| Products Updated | ${successCount} |\n`;
  report += `| Failed Updates | ${failCount} |\n\n`;

  report += `## Updates by Brand\n\n`;
  report += `| Brand | Updated | Unique Colors |\n`;
  report += `|-------|---------|---------------|\n`;

  const sortedBrands = Object.keys(byBrand).sort((a, b) =>
    byBrand[b].length - byBrand[a].length
  );

  for (const brand of sortedBrands) {
    const colors = colorsByBrand[brand] ? Array.from(colorsByBrand[brand]).join(', ') : '-';
    report += `| ${brand} | ${byBrand[brand].length} | ${colors} |\n`;
  }

  if (dryRun) {
    report += `\n## Sample Updates (First 20)\n\n`;
    const samples = results.filter(r => r.success).slice(0, 20);
    for (const sample of samples) {
      report += `### ${sample.productName}\n\n`;
      report += `- **Brand:** ${sample.brand}\n`;
      report += `- **Colors:** ${Object.keys(sample.colorImages || {}).join(', ')}\n`;
      report += `- **color_images:**\n`;
      report += `\`\`\`json\n${JSON.stringify(sample.colorImages, null, 2)}\n\`\`\`\n\n`;
    }
  }

  if (failCount > 0) {
    report += `\n## Failed Updates\n\n`;
    for (const result of results.filter(r => !r.success)) {
      report += `- **${result.productName}** (${result.brand}): ${result.error}\n`;
    }
  }

  return report;
}

async function main() {
  const results = await populateColorImages();

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Products Updated: ${successCount}`);
  console.log(`Failed: ${failCount}`);

  // Generate report
  const report = generateReport(results, DRY_RUN);
  const reportFile = DRY_RUN
    ? 'COLOR_IMAGES_POPULATE_DRY_RUN.md'
    : 'COLOR_IMAGES_POPULATE_REPORT.md';

  fs.writeFileSync(reportFile, report);
  console.log(`\n✅ Report saved to ${reportFile}`);

  // Save JSON for programmatic use
  const jsonFile = reportFile.replace('.md', '.json');
  fs.writeFileSync(jsonFile, JSON.stringify({
    generated: new Date().toISOString(),
    mode: DRY_RUN ? 'dry_run' : 'live',
    summary: {
      updated: successCount,
      failed: failCount,
    },
    results: results.map(r => ({
      id: r.productId,
      name: r.productName,
      brand: r.brand,
      success: r.success,
      colors: r.colorImages ? Object.keys(r.colorImages) : [],
      error: r.error,
      // Include full color_images in dry run for review
      ...(DRY_RUN && r.success ? { colorImages: r.colorImages } : {}),
    })),
  }, null, 2));
  console.log(`✅ JSON data saved to ${jsonFile}`);

  if (DRY_RUN) {
    console.log('\nRun without --dry-run to apply changes to the database');
  }
}

main().catch(console.error);
