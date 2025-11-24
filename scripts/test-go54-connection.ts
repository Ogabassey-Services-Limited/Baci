import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });


async function testConnection() {
    console.log('Testing Go54 API Connection...');
    console.log('Email:', process.env.GO54_EMAIL ? 'Set' : 'Not Set');
    console.log('API Key:', process.env.GO54_API_KEY ? 'Set' : 'Not Set');

    if (!process.env.GO54_EMAIL || !process.env.GO54_API_KEY) {
        console.error('❌ Missing credentials in .env.local');
        process.exit(1);
    }

    try {
        // Dynamic import to ensure env vars are loaded first
        const { getTldPricing } = await import('../src/lib/go54');

        console.log('Testing API connection with getTldPricing()...');

        // Test with a supported action
        const pricing = await getTldPricing();
        console.log('✅ API Connection Successful!');
        console.log(`Retrieved pricing for ${pricing.length} TLDs.`);

        // Log the first few items to verify structure
        if (pricing.length > 0) {
            console.log('Sample pricing:', pricing.slice(0, 2));
        }
    } catch (error: any) {
        console.error('❌ API Connection Failed');
        console.error('Error:', error.message);
        if (error.cause) {
            console.error('Cause:', error.cause);
        }
    }
}

testConnection();
