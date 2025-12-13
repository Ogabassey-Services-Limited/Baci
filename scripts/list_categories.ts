import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listCategories() {
    const { data: categories, error } = await supabase
        .from('categories')
        .select('id, name, slug, parent_id');

    if (error) {
        console.error("Error fetching categories:", error);
        return;
    }

    console.log("Existing Categories:");
    console.table(categories);
}

listCategories();
