import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const LOCAL_DIR = 'public/game-covers';

async function convertImages() {
  console.log('🚀 Converting images to AVIF...');

  if (!fs.existsSync(LOCAL_DIR)) {
    console.error(`Local directory ${LOCAL_DIR} not found.`);
    return;
  }

  const files = fs
    .readdirSync(LOCAL_DIR)
    .filter((f) => f.match(/\.(png|jpg|jpeg)$/));

  for (const file of files) {
    const nameWithoutExt = path.parse(file).name;
    const destPath = path.join(LOCAL_DIR, `${nameWithoutExt}.avif`);

    if (fs.existsSync(destPath)) {
      console.log(`Skipping ${file} - AVIF already exists.`);
      continue; // Skip if already exists
    }

    console.log(`Processing ${file}...`);

    try {
      const inputBuffer = fs.readFileSync(path.join(LOCAL_DIR, file));
      await sharp(inputBuffer)
        .resize({ width: 1000, withoutEnlargement: true })
        .avif({ quality: 65, effort: 5 })
        .toFile(destPath);

      console.log(`   ✅ Saved: ${destPath}`);
    } catch (err) {
      console.error(`   ❌ Error processing ${file}:`, err);
    }
  }
}

convertImages();
