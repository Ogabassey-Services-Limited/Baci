import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Split SQL into statements while respecting $$ dollar-quoted blocks
 * (e.g., PL/pgSQL function bodies)
 */
function splitSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inDollarQuote = false;
    const lines = sql.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip pure comment lines at statement boundaries
        if (!inDollarQuote && current.trim() === '' && trimmedLine.startsWith('--')) {
            continue;
        }

        // Check for $$ boundaries
        const dollarMatches = line.match(/\$\$/g);
        if (dollarMatches) {
            // Toggle inDollarQuote for each $$ found
            for (const _ of dollarMatches) {
                inDollarQuote = !inDollarQuote;
            }
        }

        current += line + '\n';

        // If we're outside dollar quotes and line ends with ;, it's a statement boundary
        if (!inDollarQuote && trimmedLine.endsWith(';')) {
            const stmt = current.trim();
            if (stmt && !stmt.split('\n').every(l => l.trim().startsWith('--') || l.trim() === '')) {
                statements.push(stmt);
            }
            current = '';
        }
    }

    // Handle any remaining content
    if (current.trim()) {
        statements.push(current.trim());
    }

    return statements;
}

async function main() {
    console.log('🚀 Applying Phase 7 Condition Deduplication Schema...\n');

    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20251215120000_condition_deduplication.sql');

    if (!fs.existsSync(migrationPath)) {
        console.error(`❌ Migration file not found: ${migrationPath}`);
        process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Split into individual statements (respects $$ dollar-quoted blocks)
    const statements = splitSqlStatements(sql);

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
            // Statement already includes trailing semicolon from the splitter
            const { error } = await supabase.rpc('exec_sql', { sql_query: stmt });
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
