import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import sharp from 'sharp';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const BUCKET_NAME = 'images';
const UPLOAD_DIR = 'products/gaming';
const LOCAL_DIR = 'public/game-covers';

// Map filenames to Product Names (for DB update)
const PRODUCT_MAP: Record<string, string> = {
  fc25: 'FC25',
  fc26: 'FC26',
  'hogwarts-legacy': 'Hogwarts Legacy',
  mk1: 'Mortal Kombat 1',
  'cyberpunk-2077': 'Cyberpunk 2077',
  'nba-2k25': 'NBA 26', // Mapping NBA 2K25 art to NBA 26 product
  'mk11-ultimate': 'Mortal Kombat 11 Ultimate',
};

async function processImages() {
  console.log('🚀 Starting Top Gaming Image Optimization...');

  if (!fs.existsSync(LOCAL_DIR)) {
    console.error(`Local directory ${LOCAL_DIR} not found.`);
    return;
  }

  const files = fs
    .readdirSync(LOCAL_DIR)
    .filter((f) => f.match(/\.(png|jpg|jpeg)$/));

  for (const file of files) {
    const nameWithoutExt = path.parse(file).name;
    const productName = PRODUCT_MAP[nameWithoutExt];

    if (!productName && nameWithoutExt !== 'mk11-ultimate') {
      console.log(
        `⚠️  Skipping ${file} - No product mapping found (or it's extra).`
      );
      continue;
    }

    // Special handling if no specific product mapping but it's a known file like mk11
    // We can add logic here if needed, but the map covers it.

    console.log(`\nProcessing ${file}...`);

    try {
      // 1. Convert to AVIF
      const inputBuffer = fs.readFileSync(path.join(LOCAL_DIR, file));
      const avifBuffer = await sharp(inputBuffer)
        .resize({ width: 1000, withoutEnlargement: true }) // Resize if huge
        .avif({ quality: 65, effort: 5 }) // Balanced compression
        .toBuffer();

      const avifFilename = `${nameWithoutExt}.avif`;
      const uploadPath = `${UPLOAD_DIR}/${avifFilename}`;

      console.log(
        `   🔸 Compressed: ${inputBuffer.length}b -> ${avifBuffer.length}b`
      );

      // 2. Upload to Supabase
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(uploadPath, avifBuffer, {
          contentType: 'image/avif',
          upsert: true,
        });

      if (error) {
        console.error(`   ❌ Upload failed: ${error.message}`);
        continue;
      }

      // 3. Get Public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET_NAME).getPublicUrl(uploadPath);

      console.log(`   ✅ Uploaded: ${publicUrl}`);

      // 4. Update Database
      let query = supabase
        .from('products')
        .update({ images: [publicUrl] }) // Set as array
        .eq('is_parent', true);

      if (productName === 'FC25' || productName === 'FC26') {
        query = query.eq('name', productName); // Exact match
      } else {
        query = query.ilike('name', `%${productName}%`); // Fuzzy match for others
      }

      const { error: dbError } = await query;

      if (dbError) {
        console.error(`   ❌ DB Update failed: ${dbError.message}`);
      } else {
        console.log(`   ✨ Database updated for product: "${productName}"`);
      }
    } catch (err) {
      console.error('   ❌ Error processing', file, ':', err);
    }
  }

  console.log('\n🎉 Optimization Complete!');
}

processImages();
