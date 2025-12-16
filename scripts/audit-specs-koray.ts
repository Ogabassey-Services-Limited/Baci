
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function auditSpecs() {
    console.log('🔍 Starting Technical Specs & Schema Audit (Koray\'s Framework)...\n');

    let products: any[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('products')
            .select('id, name, specifications, schema_markup, category, brand')
            .neq('status', 'archived')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching products:', error);
            return;
        }

        if (!data || data.length === 0) break;
        products = products.concat(data);

        if (data.length < pageSize) break;
        page++;
    }

    console.log(`Analyzing ${products.length} active products...\n`);

    let stats = {
        total: products.length,
        missingSpecs: 0,
        missingSchema: 0,
        goodQuality: 0,
        partialSpecs: 0 // Has specs but very few (< 3 items)
    };

    const missingSpecsProducts: any[] = [];
    const missingSchemaProducts: any[] = [];

    for (const p of products) {
        const hasSpecs = p.specifications && Array.isArray(p.specifications) && p.specifications.length > 0;
        const hasSchema = p.schema_markup && Object.keys(p.schema_markup).length > 0;

        let specItemCount = 0;
        if (hasSpecs) {
            p.specifications.forEach((section: any) => {
                if (section.items) specItemCount += section.items.length;
            });
        }

        const isPartial = hasSpecs && specItemCount < 3;

        if (!hasSpecs) {
            stats.missingSpecs++;
            missingSpecsProducts.push({ name: p.name, category: p.category });
        } else if (isPartial) {
            stats.partialSpecs++;
            // Treat partial as "missing" for quality purpose if extremely low
        }

        if (!hasSchema) {
            stats.missingSchema++;
            missingSchemaProducts.push({ name: p.name, category: p.category });
        }

        if (hasSpecs && !isPartial && hasSchema) {
            stats.goodQuality++;
        }
    }

    // Report
    console.log('📊 Tech Specs Audit Results:');
    console.log('-----------------------------------');
    console.log(`Total Products: ${stats.total}`);
    console.log(`✅ Fully Optimized (Specs + Schema): ${stats.goodQuality} (${((stats.goodQuality / stats.total) * 100).toFixed(1)}%)`);
    console.log(`⚠️  Missing Specifications: ${stats.missingSpecs}`);
    console.log(`⚠️  Thin Specifications (<3 items): ${stats.partialSpecs}`);
    console.log(`⚠️  Missing Schema Markup: ${stats.missingSchema}`);

    console.log('\n📉 Missing Specs by Category (Top 5):');
    const missingByCat: Record<string, number> = {};
    missingSpecsProducts.forEach(p => {
        missingByCat[p.category] = (missingByCat[p.category] || 0) + 1;
    });

    const sortedCats = Object.entries(missingByCat).sort(([, a], [, b]) => b - a);
    if (sortedCats.length === 0) console.log("  None!");
    sortedCats.slice(0, 5).forEach(([cat, count]) => {
        console.log(`  - ${cat}: ${count}`);
    });

    console.log('\n📉 Missing Schema by Category (Top 5):');
    const missingSchemaByCat: Record<string, number> = {};
    missingSchemaProducts.forEach(p => {
        missingSchemaByCat[p.category] = (missingSchemaByCat[p.category] || 0) + 1;
    });

    Object.entries(missingSchemaByCat).sort(([, a], [, b]) => b - a).slice(0, 5).forEach(([cat, count]) => {
        console.log(`  - ${cat}: ${count}`);
    });

}

auditSpecs();
