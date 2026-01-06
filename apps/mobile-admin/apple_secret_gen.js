const fs = require('fs');
const jwt = require('jsonwebtoken');

// ==========================================
// ⬇️ STEP 1: FILL IN THESE 3 VALUES found in Apple Developer Portal
// ==========================================

const TEAM_ID = '6QLNK7TXM3';
const KEY_ID = 'H97N9FQY69';
const PRIVATE_KEY_PATH = './AuthKey_H97N9FQY69.p8';

// The Service ID is already set for you:
const SERVICE_ID = 'com.ogabassey.baci.service';

// ==========================================

async function generate() {
    console.log("\n🍏 Generatng Apple Sign In Secret...\n");

    if (TEAM_ID.includes('YOUR_') || KEY_ID.includes('YOUR_')) {
        console.error("❌ ERROR: You must open this file and fill in TEAM_ID and KEY_ID first!");
        process.exit(1);
    }

    if (!fs.existsSync(PRIVATE_KEY_PATH)) {
        console.error(`❌ ERROR: Could not find the .p8 file at: ${PRIVATE_KEY_PATH}`);
        console.error("   Please make sure the file is in this folder and update 'PRIVATE_KEY_PATH' in this script.");
        process.exit(1);
    }

    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH);

    const secret = jwt.sign({}, privateKey, {
        algorithm: 'ES256',
        expiresIn: '180d',
        audience: 'https://appleid.apple.com',
        issuer: TEAM_ID,
        subject: SERVICE_ID,
        keyid: KEY_ID,
    });

    console.log("---------------------------------------------------");
    console.log("✅ COPY THIS ENTIRE STRING BELOW:");
    console.log("---------------------------------------------------");
    console.log(secret);
    console.log("---------------------------------------------------");
    console.log("\n📋 Paste this into Supabase 'Secret Key' field.");
}

generate();
