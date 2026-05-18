
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
// import { generateProductFAQ } from '@/ai/flows/generate-product-faq';
import type { Database } from '@/types/database.types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local (2 levels up)
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// Initialize Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials. .env.local path:', path.resolve(__dirname, '../../.env.local'));
    console.error('URL:', supabaseUrl ? 'Found' : 'Missing');
    console.error('Service Key:', supabaseServiceKey ? 'Found' : 'Missing');
    process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

async function main() {
    // Dynamically import AI flow to ensure env vars are loaded first
    const { generateProductFAQ } = await import('@/ai/flows/generate-product-faq');

    console.log('🚀 Starting bulk product FAQ generation...');

    // 1. Get Ogabassey merchant
    const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('id, business_name')
        .eq('slug', 'ogabassey')
        .single();

    if (merchantError || !merchant) {
        console.error('Merchant Ogabassey not found:', merchantError);
        return;
    }

    console.log(`Found merchant: ${merchant.business_name} (${merchant.id})`);

    // 2. Get active products without FAQs
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
      id, 
      name, 
      description, 
      price, 
      faqs,
      category,
      specifications
    `)
        .eq('merchant_id', merchant.id)
        .eq('status', 'active');

    if (productsError) {
        console.error('Error fetching products:', productsError);
        return;
    }

    // Manually fetch categories if needed or just use ID/string fallback
    // The join syntax in select might be tricky with implicit relations if not fully typed or setup
    // Let's rely on name/spec/description primarily.

    // Filter products that already have FAQs
    const productsToProcess = products?.filter((p) => {
        // Check if faqs is null or empty array
        const faqs = p.faqs as any[];
        return !faqs || faqs.length === 0;
    }) || [];

    console.log(`Found ${products?.length || 0} total active products.`);
    console.log(`Found ${productsToProcess.length} products needing FAQs.`);

    if (productsToProcess.length === 0) {
        console.log('All products already have FAQs. Exiting.');
        return;
    }

    // 3. Process in batches
    const BATCH_SIZE = 3;
    const DELAY_MS = 2000;

    for (let i = 0; i < productsToProcess.length; i += BATCH_SIZE) {
        const batch = productsToProcess.slice(i, i + BATCH_SIZE);
        console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} (${i + 1}-${Math.min(i + BATCH_SIZE, productsToProcess.length)} of ${productsToProcess.length})...`);

        await Promise.all(
            batch.map(async (product) => {
                try {
                    console.log(`Generating FAQs for: ${product.name}...`);

                    const rawSpecs = product.specifications as Record<string, unknown> | null;
                    const specs = rawSpecs || {};

                    // Generate FAQs
                    const result = await generateProductFAQ({
                        productName: product.name,
                        productDescription: product.description || '',
                        category: product.category || 'Electronics', // Fallback since we didn't join categories strictly
                        brand: (specs.Brand as string) || (specs.brand as string) || '',
                        price: product.price,
                        specifications: specs,
                    });

                    if (!result.success || !result.faqs.length) {
                        console.error(`Failed to generate for ${product.name}: ${result.error}`);
                        return;
                    }

                    // Update product in DB
                    const { error: updateError } = await supabase
                        .from('products')
                        .update({
                            faqs: result.faqs as any,
                        })
                        .eq('id', product.id);

                    if (updateError) {
                        console.error(`Failed to save FAQs for ${product.name}:`, updateError);
                    } else {
                        console.log(`✅ Saved ${result.faqs.length} FAQs for ${product.name}`);
                    }
                } catch (err) {
                    console.error(`Exception processing ${product.name}:`, err);
                }
            })
        );

        if (i + BATCH_SIZE < productsToProcess.length) {
            console.log(`Waiting ${DELAY_MS}ms...`);
            await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        }
    }

    console.log('\n🎉 Bulk generation complete!');
}

main().catch(console.error);
