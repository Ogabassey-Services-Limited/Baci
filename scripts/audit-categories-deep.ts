
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function deepCategoryAudit() {
    // Get all unique category values
    const { data: all } = await supabase
        .from('products')
        .select('category')
        .neq('status', 'archived');

    const categories = new Map<string, number>();
    let nullCount = 0;
    let emptyCount = 0;
    let whitespaceCount = 0;

    for (const p of all || []) {
        if (p.category === null) {
            nullCount++;
        } else if (p.category === '') {
            emptyCount++;
        } else if (p.category.trim() === '') {
            whitespaceCount++;
        } else {
            const cat = p.category.trim();
            categories.set(cat, (categories.get(cat) || 0) + 1);
        }
    }

    console.log('📂 DEEP CATEGORY AUDIT');
    console.log('======================');
    console.log('Total Products:', all?.length || 0);
    console.log('');
    console.log('Null categories:', nullCount);
    console.log('Empty string categories:', emptyCount);
    console.log('Whitespace-only categories:', whitespaceCount);
    console.log('');
    console.log('Unique Categories:', categories.size);
    console.log('');
    console.log('Category Distribution:');

    // Sort by count
    const sorted = [...categories.entries()].sort((a, b) => b[1] - a[1]);
    for (const [cat, count] of sorted) {
        console.log(`  ${cat}: ${count}`);
    }
}

deepCategoryAudit();
