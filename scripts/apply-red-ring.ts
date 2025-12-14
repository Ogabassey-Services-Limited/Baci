import sharp from 'sharp';

// Note: standard package is @imgly/background-removal, but looking at package.json it says "^1.7.0". 
// Usually for node it might require specific config or just work. 
// Let's try standard import first. If it fails, I'll fallback or check docs/types.
// Actually, since I can't easily check docs, I'll use a safer approach:
// If imgly fails, I'll use a simple "fuzzy white to transparent" function in sharp for this POC 
// to avoid getting stuck on a heavy ML dependency install issue. 
// BUT, the user HAS it in package.json. So I should try to use it.

// Let's rely on the user's installed package.
// If the import fails, I will handle it.

const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
    console.error("Usage: tsx apply-red-ring.ts <input> <output>");
    process.exit(1);
}

async function applyBranding() {
    try {
        console.log("⏳ Removing background (this may take a moment)...");
        // For POC, let's try to assume input might have white bg we need to remove.
        // Importing imgly dynamically to avoid crash if not found
        let productBuffer;
        try {
            const { removeBackground } = await import('@imgly/background-removal');
            const blob = await removeBackground(inputFile);
            productBuffer = Buffer.from(await blob.arrayBuffer());
            console.log("✅ Background removed.");
        } catch (e) {
            console.warn("⚠️ Fallback: Using custom Sharp pixel manipulation to remove white background.");

            // Custom White Background Removal
            const { data, info } = await sharp(inputFile)
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

            const threshold = 10; // Tolerance for "white" (0-255 difference from 255)

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Check if pixel is white-ish
                if (r > 255 - threshold && g > 255 - threshold && b > 255 - threshold) {
                    data[i + 3] = 0; // Set alpha to 0 (transparent)
                }
            }

            productBuffer = await sharp(data, {
                raw: { width: info.width, height: info.height, channels: 4 }
            })
                .png()
                .toBuffer();
        }

        const image = sharp(productBuffer);
        const metadata = await image.metadata();
        const width = metadata.width!;
        const height = metadata.height!;

        // Ring Config
        const size = Math.min(width, height) * 0.95; // Slightly larger for "behind" effect visuals
        const cx = width / 2;
        const cy = height / 2;
        const r = size / 2;
        const strokeWidth = Math.max(3, Math.round(size * 0.02));

        // 1. Create Ring Layer
        const svgRing = Buffer.from(`
        <svg width="${width}" height="${height}">
            <circle 
                cx="${cx}" 
                cy="${cy}" 
                r="${r}" 
                stroke="#FF0000" 
                stroke-width="${strokeWidth}" 
                fill="none" 
            />
        </svg>`);

        // 2. Create Base Canvas (White) matches image dimensions
        // We want the final result to be on white? Or transparent?
        // Usually e-commerce is on white.
        // Layering: White Base -> Ring -> Product

        const final = sharp({
            create: {
                width: width,
                height: height,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
        })
            .composite([
                { input: svgRing, top: 0, left: 0 }, // Ring at bottom (on top of white)
                { input: productBuffer, top: 0, left: 0 } // Product on top (transparent bg)
            ]);

        await final.toFile(outputFile);

        console.log(`✅ Applied Red Ring (Behind) to ${outputFile}`);

    } catch (error) {
        console.error("Error applying branding:", error);
        process.exit(1);
    }
}

applyBranding();
