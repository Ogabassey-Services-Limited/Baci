import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
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
const SKIP_UPLOAD = args.includes('--skip-upload');
const LIMIT_ARG = args.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 0;

if (DRY_RUN) {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');
}

// CDN configuration
const CDN_HOST = 'bassey@82.29.190.219';
const CDN_PATH = '/var/www/cdn/products/';
const CDN_URL_BASE = 'https://cdn.ogabassey.com/products/';

// Local images directory
const LOCAL_IMAGES_DIR = path.join(process.cwd(), 'public', 'website designs');

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
  'snow', 'sea', 'cloudy', 'jet',
];

// Compound color prefixes
const COMPOUND_PREFIXES = ['space', 'deep', 'rose', 'aura', 'mystic', 'phantom', 'prism', 'natural', 'desert', 'jet', 'cloudy', 'product'];

function titleCase(str: string): string {
  return str.split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractColorFromFilename(filename: string): string | null {
  // Remove extension and path
  const name = path.basename(filename, path.extname(filename));
  const words = name.split(/[\s-_]+/);

  // Search from end for color keywords
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i].toLowerCase();
    if (COLOR_KEYWORDS.includes(word)) {
      // Check for compound colors like "Space Gray", "Jet Black"
      if (i > 0 && COMPOUND_PREFIXES.includes(words[i - 1].toLowerCase())) {
        return titleCase(words[i - 1] + ' ' + words[i]);
      }
      // Handle special case: "(Red)" -> "Red"
      if (word === 'red' && i > 0 && words[i - 1].toLowerCase() === 'product') {
        return 'Product Red';
      }
      return titleCase(word);
    }
  }
  return null;
}

function extractProductNameFromFilename(filename: string): string {
  // Remove extension
  const name = path.basename(filename, path.extname(filename));
  // Remove color from end if present
  const words = name.split(/[\s-_]+/);

  // Find where color starts from the end
  let colorStartIndex = words.length;
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i].toLowerCase();
    if (COLOR_KEYWORDS.includes(word)) {
      colorStartIndex = i;
      // Check for compound prefix
      if (i > 0 && COMPOUND_PREFIXES.includes(words[i - 1].toLowerCase())) {
        colorStartIndex = i - 1;
      }
      break;
    }
  }

  // Return product name without color
  return words.slice(0, colorStartIndex).join(' ').trim();
}

interface LocalImage {
  fullPath: string;
  filename: string;
  productName: string;
  color: string | null;
  cdnFilename: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  images: string[] | null;
  color_images: Record<string, string[]> | null;
}

interface MatchResult {
  product: Product;
  localImages: LocalImage[];
  newColorImages: Record<string, string[]>;
  imagesToUpload: LocalImage[];
}

// Recursively find all image files
function findLocalImages(dir: string): LocalImage[] {
  const images: LocalImage[] = [];

  function walkDir(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && /\.(avif|webp|png|jpg|jpeg)$/i.test(entry.name)) {
        const color = extractColorFromFilename(entry.name);
        const productName = extractProductNameFromFilename(entry.name);
        const cdnFilename = slugify(path.basename(entry.name, path.extname(entry.name))) + path.extname(entry.name).toLowerCase();

        images.push({
          fullPath,
          filename: entry.name,
          productName,
          color,
          cdnFilename,
        });
      }
    }
  }

  walkDir(dir);
  return images;
}

// Normalize product name for matching
function normalizeForMatching(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // Remove parenthetical content
    .replace(/uk used|us used|new open box|open box|fairly used|refurbished|premium used/gi, '')
    .replace(/physical\s*\+?\s*esim|esim|dual sim/gi, '')
    .replace(/\d+gb\s*\d*gb|\d+gb/gi, '') // Remove storage specs like "6GB 128GB"
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if image exists on CDN
function checkCdnImage(cdnFilename: string): boolean {
  try {
    const result = execSync(`ssh ${CDN_HOST} "ls ${CDN_PATH}${cdnFilename}" 2>/dev/null`, { encoding: 'utf-8' });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

// Upload image to CDN
function uploadToCdn(localPath: string, cdnFilename: string): boolean {
  try {
    execSync(`scp "${localPath}" ${CDN_HOST}:${CDN_PATH}${cdnFilename}`, { encoding: 'utf-8' });
    return true;
  } catch (error: any) {
    console.error(`  Failed to upload ${cdnFilename}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('UPLOAD MISSING IMAGES');
  console.log('='.repeat(60));
  console.log();

  // 1. Find all local images
  console.log(`Scanning local images in: ${LOCAL_IMAGES_DIR}\n`);
  const localImages = findLocalImages(LOCAL_IMAGES_DIR);
  console.log(`Found ${localImages.length} local images\n`);

  // Filter to images with colors
  const colorImages = localImages.filter(img => img.color !== null);
  console.log(`Images with detectable colors: ${colorImages.length}\n`);

  if (VERBOSE) {
    console.log('Sample local images:');
    for (const img of colorImages.slice(0, 10)) {
      console.log(`  ${img.filename}`);
      console.log(`    Product: ${img.productName}`);
      console.log(`    Color: ${img.color}`);
      console.log(`    CDN name: ${img.cdnFilename}`);
    }
    console.log();
  }

  // 2. Fetch all products
  console.log('Fetching products from database...\n');
  let allProducts: Product[] = [];
  let offset = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data: batch, error } = await supabase
      .from('products')
      .select('id, name, slug, brand, images, color_images')
      .eq('status', 'active')
      .range(offset, offset + PAGE_SIZE - 1);

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

  // 3. Match local images to products
  console.log('Matching local images to products...\n');
  const matches: MatchResult[] = [];
  const unmatchedImages: LocalImage[] = [];

  // Create normalized name lookup
  const productsByNormalizedName = new Map<string, Product[]>();
  for (const product of allProducts) {
    const normalized = normalizeForMatching(product.name);
    if (!productsByNormalizedName.has(normalized)) {
      productsByNormalizedName.set(normalized, []);
    }
    productsByNormalizedName.get(normalized)!.push(product);
  }

  // Match images to products
  const imagesByProduct = new Map<string, LocalImage[]>();

  for (const img of colorImages) {
    const normalizedImgName = normalizeForMatching(img.productName);
    let matched = false;

    // Try exact match first
    if (productsByNormalizedName.has(normalizedImgName)) {
      const products = productsByNormalizedName.get(normalizedImgName)!;
      for (const product of products) {
        if (!imagesByProduct.has(product.id)) {
          imagesByProduct.set(product.id, []);
        }
        imagesByProduct.get(product.id)!.push(img);
        matched = true;
      }
    }

    // Try partial match if no exact match
    if (!matched) {
      for (const [normalizedName, products] of productsByNormalizedName) {
        // Check if image name is contained in product name or vice versa
        if (normalizedName.includes(normalizedImgName) || normalizedImgName.includes(normalizedName)) {
          for (const product of products) {
            if (!imagesByProduct.has(product.id)) {
              imagesByProduct.set(product.id, []);
            }
            imagesByProduct.get(product.id)!.push(img);
            matched = true;
          }
          break;
        }
      }
    }

    if (!matched) {
      unmatchedImages.push(img);
    }
  }

  console.log(`Matched images to ${imagesByProduct.size} products\n`);
  console.log(`Unmatched images: ${unmatchedImages.length}\n`);

  // 4. Process matches
  let productsToUpdate = 0;
  let imagesToUpload = 0;

  for (const [productId, images] of imagesByProduct) {
    const product = allProducts.find(p => p.id === productId)!;
    const existingColorImages = product.color_images || {};
    const existingImages = product.images || [];
    const newColorImages: Record<string, string[]> = { ...existingColorImages };
    const toUpload: LocalImage[] = [];

    for (const img of images) {
      if (!img.color) continue;

      const cdnUrl = CDN_URL_BASE + img.cdnFilename;

      // Check if this URL already exists in product images
      if (existingImages.includes(cdnUrl)) {
        // Image exists, just need to add to color_images if not there
        if (!newColorImages[img.color]) {
          newColorImages[img.color] = [];
        }
        if (!newColorImages[img.color].includes(cdnUrl)) {
          newColorImages[img.color].push(cdnUrl);
        }
      } else {
        // Image doesn't exist in product, need to upload and add
        toUpload.push(img);
        if (!newColorImages[img.color]) {
          newColorImages[img.color] = [];
        }
        if (!newColorImages[img.color].includes(cdnUrl)) {
          newColorImages[img.color].push(cdnUrl);
        }
      }
    }

    // Check if there are changes
    const hasNewColors = Object.keys(newColorImages).length > Object.keys(existingColorImages).length;
    const hasNewImages = toUpload.length > 0;

    if (hasNewColors || hasNewImages) {
      matches.push({
        product,
        localImages: images,
        newColorImages,
        imagesToUpload: toUpload,
      });
      productsToUpdate++;
      imagesToUpload += toUpload.length;
    }
  }

  console.log(`Products to update: ${productsToUpdate}`);
  console.log(`Images to upload: ${imagesToUpload}\n`);

  if (LIMIT > 0 && matches.length > LIMIT) {
    matches.length = LIMIT;
    console.log(`Limited to first ${LIMIT} products\n`);
  }

  // 5. Execute updates
  if (DRY_RUN) {
    console.log('DRY RUN - Sample updates:\n');
    for (const match of matches.slice(0, 10)) {
      console.log(`\n${match.product.name}`);
      console.log(`  Current colors: ${Object.keys(match.product.color_images || {}).join(', ') || 'none'}`);
      console.log(`  New colors: ${Object.keys(match.newColorImages).join(', ')}`);
      console.log(`  Images to upload: ${match.imagesToUpload.length}`);
      for (const img of match.imagesToUpload.slice(0, 3)) {
        console.log(`    - ${img.filename} → ${img.cdnFilename}`);
      }
    }
  } else {
    let updated = 0;
    let uploaded = 0;

    for (const match of matches) {
      if (VERBOSE) {
        console.log(`\nProcessing: ${match.product.name}`);
      }

      // Upload images if needed
      if (!SKIP_UPLOAD) {
        for (const img of match.imagesToUpload) {
          // Check if already on CDN
          const exists = checkCdnImage(img.cdnFilename);
          if (!exists) {
            if (VERBOSE) {
              console.log(`  Uploading: ${img.cdnFilename}`);
            }
            const success = uploadToCdn(img.fullPath, img.cdnFilename);
            if (success) {
              uploaded++;
            }
          } else if (VERBOSE) {
            console.log(`  Already on CDN: ${img.cdnFilename}`);
          }
        }
      }

      // Update product in database
      const newImages = [...(match.product.images || [])];
      for (const img of match.imagesToUpload) {
        const cdnUrl = CDN_URL_BASE + img.cdnFilename;
        if (!newImages.includes(cdnUrl)) {
          newImages.push(cdnUrl);
        }
      }

      const { error: updateError } = await supabase
        .from('products')
        .update({
          images: newImages,
          color_images: match.newColorImages,
        })
        .eq('id', match.product.id);

      if (updateError) {
        console.error(`  Failed to update ${match.product.name}: ${updateError.message}`);
      } else {
        updated++;
        if (!VERBOSE) {
          process.stdout.write(`\rUpdated: ${updated} / ${matches.length}`);
        }
      }
    }

    console.log('\n');
    console.log(`Products updated: ${updated}`);
    console.log(`Images uploaded: ${uploaded}`);
  }

  // 6. Generate report
  const report = generateReport(matches, unmatchedImages, DRY_RUN);
  const reportFile = DRY_RUN ? 'UPLOAD_IMAGES_DRY_RUN.md' : 'UPLOAD_IMAGES_REPORT.md';
  fs.writeFileSync(reportFile, report);
  console.log(`\n✅ Report saved to ${reportFile}`);
}

function generateReport(matches: MatchResult[], unmatched: LocalImage[], dryRun: boolean): string {
  let report = `# Upload Missing Images Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Mode:** ${dryRun ? 'DRY RUN' : 'LIVE'}\n\n`;

  report += `## Summary\n\n`;
  report += `| Metric | Count |\n`;
  report += `|--------|-------|\n`;
  report += `| Products to update | ${matches.length} |\n`;
  report += `| Images to upload | ${matches.reduce((sum, m) => sum + m.imagesToUpload.length, 0)} |\n`;
  report += `| Unmatched images | ${unmatched.length} |\n\n`;

  if (dryRun && matches.length > 0) {
    report += `## Sample Updates\n\n`;
    for (const match of matches.slice(0, 20)) {
      report += `### ${match.product.name}\n\n`;
      report += `- **Current colors:** ${Object.keys(match.product.color_images || {}).join(', ') || 'none'}\n`;
      report += `- **New colors:** ${Object.keys(match.newColorImages).join(', ')}\n`;
      report += `- **Images to upload:** ${match.imagesToUpload.length}\n`;
      if (match.imagesToUpload.length > 0) {
        report += `- **Files:**\n`;
        for (const img of match.imagesToUpload.slice(0, 5)) {
          report += `  - ${img.filename} → ${img.cdnFilename}\n`;
        }
      }
      report += `\n`;
    }
  }

  if (unmatched.length > 0) {
    report += `## Unmatched Images (no product found)\n\n`;
    for (const img of unmatched.slice(0, 50)) {
      report += `- ${img.filename} (looked for: "${img.productName}")\n`;
    }
    if (unmatched.length > 50) {
      report += `\n... and ${unmatched.length - 50} more\n`;
    }
  }

  return report;
}

main().catch(console.error);
