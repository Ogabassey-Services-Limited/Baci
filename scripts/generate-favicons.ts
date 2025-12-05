import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const PUBLIC_DIR = join(process.cwd(), 'public');
const LOGO_SVG = join(PUBLIC_DIR, 'baci-logo.svg');

// Sizes to generate
const SIZES = {
    'favicon-16x16.png': 16,
    'favicon-32x32.png': 32,
    'apple-touch-icon.png': 180,
    'android-chrome-192x192.png': 192,
    'android-chrome-512x512.png': 512,
};

// Maskable sizes (with safe area padding)
const MASKABLE_SIZES = {
    'android-chrome-192x192-maskable.png': 192,
    'android-chrome-512x512-maskable.png': 512,
};

async function generateFavicons() {
    console.log('🎨 Starting favicon generation...\n');

    try {
        const svgBuffer = readFileSync(LOGO_SVG);

        // Generate standard favicons
        for (const [filename, size] of Object.entries(SIZES)) {
            await sharp(svgBuffer)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 0 },
                })
                .png()
                .toFile(join(PUBLIC_DIR, filename));

            console.log(`✓ Generated ${filename} (${size}x${size})`);
        }

        // Generate maskable icons (with 20% padding for 80% safe area)
        for (const [filename, size] of Object.entries(MASKABLE_SIZES)) {
            const padding = Math.floor(size * 0.1); // 10% padding on each side = 80% safe area
            const innerSize = size - (padding * 2);

            await sharp(svgBuffer)
                .resize(innerSize, innerSize, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 0 },
                })
                .extend({
                    top: padding,
                    bottom: padding,
                    left: padding,
                    right: padding,
                    background: { r: 255, g: 255, b: 255, alpha: 1 },
                })
                .png()
                .toFile(join(PUBLIC_DIR, filename));

            console.log(`✓ Generated ${filename} (${size}x${size}) with safe area`);
        }

        // Generate multi-size ICO file
        console.log('\n🔧 Generating favicon.ico...');

        // Generate 32x32 for ICO (16x16 not needed as we use 32x32 only)
        const ico32 = await sharp(svgBuffer)
            .resize(32, 32, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 0 },
            })
            .png()
            .toBuffer();

        // Note: For production, consider using a library like 'png-to-ico' for true ICO format
        // For now, we'll use the 32x32 PNG as favicon.ico
        writeFileSync(join(PUBLIC_DIR, 'favicon.ico'), ico32);
        console.log('✓ Generated favicon.ico (using 32x32)');

        console.log('\n✨ All favicons generated successfully!');
        console.log('\nGenerated files:');
        console.log('  - favicon.ico');
        console.log('  - favicon-16x16.png');
        console.log('  - favicon-32x32.png');
        console.log('  - apple-touch-icon.png (180x180)');
        console.log('  - android-chrome-192x192.png');
        console.log('  - android-chrome-512x512.png');
        console.log('  - android-chrome-192x192-maskable.png');
        console.log('  - android-chrome-512x512-maskable.png');

    } catch (error) {
        console.error('❌ Error generating favicons:', error);
        process.exit(1);
    }
}

generateFavicons();
