
import { config } from 'dotenv';
config({ path: '.env.local' });

const MYCOVER_BASE_URL = 'https://api.mycover.ai/v1';

async function listProducts() {
    const secretKey = process.env.MYCOVER_SECRET_KEY;
    if (!secretKey) {
        console.error('❌ MYCOVER_SECRET_KEY not found in .env.local');
        return;
    }

    console.log('📡 Fetching available MyCover products...');

    try {
        console.log('Trying GET /products (generic list)...');
        const response = await fetch(`${MYCOVER_BASE_URL}/products`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json'
            }
        });

        const text = await response.text();
        console.log('Response Status:', response.status);
        console.log('Response Body:', text);

        if (response.ok) {
            const data = JSON.parse(text);
            console.log('✅ Success! Found products:');
            if (data.data && Array.isArray(data.data)) {
                data.data.forEach((p: any) => {
                    console.log("- [" + p.id + "]", p.name, "(Category: " + (p.category?.name || 'N/A') + ")");
                });
            }
        }
    } catch (e) {
        console.error('❌ Network error:', e);
    }
}

listProducts();
