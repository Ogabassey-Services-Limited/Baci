
import { config } from 'dotenv';
config({ path: '.env.local' });

const BASE_URL = 'https://api.mycover.ai/v1';

async function probe() {
    const key = process.env.MYCOVER_SECRET_KEY;
    if (!key) { console.error('No key'); return; }

    console.log('🕵️‍♀️ Fetching a valid Policy ID...');
    let policyId = '';
    try {
        const res = await fetch(`${BASE_URL}/policies?limit=1`, {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        const data = await res.json();
        if (data.data && data.data.policies && data.data.policies.length > 0) {
            policyId = data.data.policies[0].id;
            console.log("   ✅ Found Policy ID:", policyId);
        } else {
            console.log('   ❌ No policies found to test with.');
        }
    } catch (e) {
        console.error('Failed to fetch policies');
    }

    const PROBE_LIST = [
        { method: 'POST', url: '/claims' },
        { method: 'POST', url: '/claims/file' },
        { method: 'POST', url: '/products/sti/claim' },
        { method: 'POST', url: '/products/gadget/claim' },
        { method: 'POST', url: '/claims/initiate' }
    ];

    if (policyId) {
        PROBE_LIST.push(
            { method: 'POST', url: `/policies/${policyId}/claim` },
            { method: 'POST', url: `/policies/${policyId}/claims` },
            { method: 'POST', url: `/claim/${policyId}` }
        );
    }

    console.log('\n🕵️‍♀️ Probing Claims Endpoints...');

    for (const ep of PROBE_LIST) {
        try {
            console.log("\n👉 Testing", ep.method, ep.url, "...");
            const res = await fetch(`${BASE_URL}${ep.url}`, {
                method: ep.method,
                headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            console.log("   Status:", res.status);

            if (res.status !== 404) {
                const txt = await res.text();
                console.log(`   🔎 INTERESTING! Not a 404!`);
                console.log("   Response:", txt.slice(0, 300));
            }
        } catch (e: any) {
            console.log("   ⚠️ Network Error on", ep.url, ":", e.message);
        }
    }
}

probe();
