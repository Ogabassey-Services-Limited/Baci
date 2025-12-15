import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
    console.log('Checking for duplicate slugs...');

    // Try the RPC approach first
    const { data: rpcData, error: rpcError } = await supabase.rpc('check_duplicate_slugs');

    if (!rpcError && rpcData && rpcData.length > 0) {
        console.log(`Found ${rpcData.length} duplicate sets via RPC! ⚠️`);
        for (const dup of rpcData) {
            console.log(`Duplicate: ${dup.merchant_id}:${dup.slug} -> Count: ${dup.count}`);
        }
        return;
    }

    // If RPC failed or returned nothing, try creating a function
    const createFunc = `
    CREATE OR REPLACE FUNCTION get_duplicate_slugs()
    RETURNS TABLE (merchant_id uuid, slug text, count bigint)
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT p.merchant_id, p.slug, count(*)
      FROM products p
      GROUP BY p.merchant_id, p.slug
      HAVING count(*) > 1;
    END;
    $$;
  `;

    const { error: funcError } = await supabase.rpc('exec_sql', { sql_query: createFunc });

    if (funcError) {
        console.warn('Could not create helper function (likely permissions), falling back to in-memory check');
    }

    // Fallback: In-memory check (efficient enough for <10k products)
    let allProducts: { id: string; slug: string; merchant_id: string }[] = [];
    let page = 0;
    let pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data: pageData, error: fetchError } = await supabase
            .from('products')
            .select('id, slug, merchant_id')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (fetchError) {
            console.error('Error fetching products:', fetchError);
            return;
        }

        if (pageData && pageData.length > 0) {
            allProducts.push(...pageData);
            page++;
            console.log(`Fetched ${allProducts.length} products...`);
        } else {
            hasMore = false;
        }
    }

    const seen = new Map<string, string[]>(); // Key: "merchant_id:slug", Value: [id1, id2...]

    for (const p of allProducts) {
        const key = `${p.merchant_id}:${p.slug}`;
        if (seen.has(key)) {
            seen.get(key)?.push(p.id);
        } else {
            seen.set(key, [p.id]);
        }
    }

    const duplicates = Array.from(seen.entries()).filter(([_, ids]) => ids.length > 1);

    if (duplicates.length === 0) {
        console.log('No duplicates found! ✅');
    } else {
        console.log(`Found ${duplicates.length} duplicate sets! ⚠️`);
        for (const [key, ids] of duplicates) {
            console.log(`Duplicate: ${key} -> IDs: ${ids.join(', ')}`);
        }
    }
}

checkDuplicates().catch((err) => {
    console.error('Failed to check duplicates:', err);
    process.exit(1);
});
