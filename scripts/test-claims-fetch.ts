import { config } from 'dotenv';
config({ path: '.env.local' });

// We only import what we need from the lib, assuming it doesn't import server-only stuff
import { createMyCoverClient } from '@/lib/mycover';

async function testClaimsFetch() {
    const secretKey = process.env.MYCOVER_SECRET_KEY;
    if (!secretKey) { console.error('No key'); return; }

    console.log('📡 Fetching Claims from API...');

    try {
        const client = createMyCoverClient();
        if (!client) return;

        const claims = await client.getClaims();
        console.log(`✅ Success! Found ${claims.length} claims.`);
        if (claims.length > 0) {
            console.log('Sample Claim:', claims[0]);
        }
    } catch (e) {
        console.error('❌ Failed:', e instanceof Error ? e.message : String(e));
    }
}

testClaimsFetch();
