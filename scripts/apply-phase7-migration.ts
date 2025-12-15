
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log('🚀 Applying Phase 7 Condition Deduplication Schema...\n');

    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20251215120000_condition_deduplication.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Split into individual statements (simple approach)
    const statements = sql
        .split(/;\s*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute.\n`);

    let success = 0;
    let failed = 0;

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        // Skip comments-only blocks
        if (stmt.split('\n').every(line => line.trim().startsWith('--') || line.trim() === '')) {
            continue;
        }

        try {
            const { error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' });
            if (error) {
                // Try direct query as fallback (won't work for DDL but let's try)
                console.log(`⚠️ Statement ${i + 1}: RPC failed, trying direct...`);
                // For DDL we need to use the DB directly
                // Since we can't do that easily, we'll log and continue
                console.log(`❌ Statement ${i + 1} failed: ${error.message}`);
                failed++;
            } else {
                console.log(`✅ Statement ${i + 1} executed successfully.`);
                success++;
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.log(`❌ Statement ${i + 1} exception: ${errorMessage}`);
            failed++;
        }
    }

    console.log(`\n--- Summary ---`);
    console.log(`✅ Success: ${success}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
        console.log(`\n⚠️ Some statements failed. You may need to run the migration manually via Supabase Dashboard SQL Editor.`);
        console.log(`Migration file: ${migrationPath}`);
    }
}

main().catch(console.error);
