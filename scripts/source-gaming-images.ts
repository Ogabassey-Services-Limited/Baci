import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const games = [
    { name: "EA Sports FC 25 (PS5)", slug: "ea-sports-fc-25" },
    { name: "Call of Duty: Black Ops 6 (PS5)", slug: "call-of-duty-black-ops-6" },
    { name: "Marvel's Spider-Man 2 (PS5)", slug: "marvels-spider-man-2" },
    { name: "God of War Ragnarök (PS5)", slug: "god-of-war-ragnarok" },
    { name: "Grand Theft Auto V (PS5)", slug: "grand-theft-auto-v" },
    { name: "Elden Ring (PS5)", slug: "elden-ring" },
    { name: "Mortal Kombat 1 (PS5)", slug: "mortal-kombat-1" },
    { name: "Tekken 8 (PS5)", slug: "tekken-8" },
    { name: "Hogwarts Legacy (PS5)", slug: "hogwarts-legacy" },
    { name: "The Last of Us Part II Remastered (PS5)", slug: "the-last-of-us-part-ii-remastered" },
    { name: "Cyberpunk 2077 (PS5)", slug: "cyberpunk-2077" },
    { name: "Assassin's Creed Mirage (PS5)", slug: "assassins-creed-mirage" },
    { name: "Resident Evil 4 Remake (PS5)", slug: "resident-evil-4" },
    { name: "Star Wars Jedi: Survivor (PS5)", slug: "star-wars-jedi-survivor" },
    { name: "Ghost of Tsushima Director's Cut (PS5)", slug: "ghost-of-tsushima-directors-cut" },
    { name: "Gran Turismo 7 (PS5)", slug: "gran-turismo-7" },
    { name: "Horizon Forbidden West (PS5)", slug: "horizon-forbidden-west" },
    { name: "NBA 2K25 (PS5)", slug: "nba-2k25" },
    { name: "WWE 2K24 (PS5)", slug: "wwe-2k24" },
    { name: "Final Fantasy XVI (PS5)", slug: "final-fantasy-xvi" }
];

const RAW_DIR = path.join(process.cwd(), 'gaming_raw_images');
if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR);

async function sourceImages() {
    console.log(`Starting Sourcing for ${games.length} games...`);

    for (const game of games) {
        const url = `https://www.playstation.com/en-us/games/${game.slug}/`;
        const dest = path.join(RAW_DIR, `${game.slug}.jpg`); // Default extensions later

        if (fs.existsSync(dest)) {
            console.log(`Skipping ${game.slug} (Exists)`);
            continue;
        }

        try {
            console.log(`Fetching ${game.slug}...`);
            // Curl the page with User-Agent
            const { stdout } = await execAsync(`curl -L -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36" "${url}"`);

            // Extract og:image
            // Look for <meta property="og:image" content="...">
            const match = stdout.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                stdout.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);

            if (match && match[1]) {
                const imgUrl = match[1];
                console.log(`   Found Image: ${imgUrl}`);

                // Download with User-Agent
                await execAsync(`curl -L -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36" "${imgUrl}" -o "${dest}"`);
                console.log(`   Downloaded.`);
            } else {
                console.log(`   ❌ Image not found in metadata.`);
            }
        } catch (e: any) {
            console.error(`   ❌ Failed: ${e.message}`);
        }

        // Polite delay
        await new Promise(r => setTimeout(r, 500));
    }
}

sourceImages();
