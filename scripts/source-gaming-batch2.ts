import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Nintendo Switch games - using nintendo.com store pages
const games = [
    { slug: "zelda-tears-of-the-kingdom", nintendoSlug: "the-legend-of-zelda-tears-of-the-kingdom-switch" },
    { slug: "zelda-breath-of-the-wild", nintendoSlug: "the-legend-of-zelda-breath-of-the-wild-switch" },
    { slug: "super-mario-odyssey", nintendoSlug: "super-mario-odyssey-switch" },
    { slug: "mario-kart-8-deluxe", nintendoSlug: "mario-kart-8-deluxe-switch" },
    { slug: "super-smash-bros-ultimate", nintendoSlug: "super-smash-bros-ultimate-switch" },
    { slug: "pokemon-scarlet", nintendoSlug: "pokemon-scarlet-switch" },
    { slug: "pokemon-violet", nintendoSlug: "pokemon-violet-switch" },
    { slug: "pokemon-legends-arceus", nintendoSlug: "pokemon-legends-arceus-switch" },
    { slug: "luigis-mansion-3", nintendoSlug: "luigis-mansion-3-switch" },
    { slug: "super-mario-bros-wonder", nintendoSlug: "super-mario-bros-wonder-switch" },
    { slug: "animal-crossing-new-horizons", nintendoSlug: "animal-crossing-new-horizons-switch" },
    { slug: "splatoon-3", nintendoSlug: "splatoon-3-switch" },
    { slug: "fire-emblem-three-houses", nintendoSlug: "fire-emblem-three-houses-switch" },
    { slug: "metroid-dread", nintendoSlug: "metroid-dread-switch" },
    { slug: "donkey-kong-country-returns-hd", nintendoSlug: "donkey-kong-country-returns-hd-switch" },
    { slug: "the-witcher-3-wild-hunt", nintendoSlug: "the-witcher-3-wild-hunt-complete-edition-switch" },
    { slug: "red-dead-redemption", nintendoSlug: "red-dead-redemption-switch" },
    { slug: "minecraft", nintendoSlug: "minecraft-switch" },
    { slug: "gta-trilogy-definitive-edition", nintendoSlug: "grand-theft-auto-the-trilogy-the-definitive-edition-switch" },
    { slug: "dark-souls-remastered", nintendoSlug: "dark-souls-remastered-switch" }
];

const RAW_DIR = path.join(process.cwd(), 'gaming_raw_images');
if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR);

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36";

async function sourceImages() {
    console.log(`Starting Sourcing for ${games.length} Nintendo Switch games...`);

    for (const game of games) {
        const dest = path.join(RAW_DIR, `${game.slug}.jpg`);

        if (fs.existsSync(dest)) {
            console.log(`Skipping ${game.slug} (Exists)`);
            continue;
        }

        const url = `https://www.nintendo.com/us/store/products/${game.nintendoSlug}/`;

        try {
            console.log(`Fetching ${game.slug}...`);
            const { stdout } = await execAsync(`curl -L -s -A "${UA}" "${url}"`);

            // Extract og:image
            const match = stdout.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                stdout.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);

            if (match && match[1]) {
                const imgUrl = match[1];
                console.log(`   Found Image: ${imgUrl}`);

                await execAsync(`curl -L -s -A "${UA}" "${imgUrl}" -o "${dest}"`);
                console.log(`   Downloaded.`);
            } else {
                console.log(`   ❌ Image not found in metadata.`);
            }
        } catch (e) {
            console.error(`   ❌ Failed: ${e instanceof Error ? e.message : String(e)}`);
        }

        await new Promise(r => setTimeout(r, 500));
    }
}

sourceImages();
