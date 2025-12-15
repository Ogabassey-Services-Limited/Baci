
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDuplicates() {
    console.log('Checking for duplicate slugs...');

    // Query to find duplicates
    // We want to find slug, merchant_id pairs that appear more than once
    const { data, error } = await supabase.rpc('check_duplicate_slugs');

    // Supabase RPC is the best way, but let's try a raw SQL query via a temporary function if RPC doesn't exist,
    // or just fetch all keys and process in memory if the dataset isn't huge (risky).
    // Better approach: Use a raw query with the pg driver connection if available? Node.js usually doesn't expose it directly here.
    // We can try to create a function first.

    // Let's try creating a temp function to check duplicates
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

    const { error: funcError } = await supabase.rpc('exec_sql', { sql: createFunc });

    // If we can't create functions (permissions), we'll do a paginated fetch and check in memory.
    // Assuming we might not have 'exec_sql' RPC helper.

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
            allProducts = [...allProducts, ...pageData];
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

checkDuplicates();
