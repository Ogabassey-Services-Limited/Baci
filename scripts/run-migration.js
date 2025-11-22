#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment variables from .env.local manually
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...values] = line.split('=');
    if (key) envVars[key.trim()] = values.join('=').trim();
  }
});

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Read the migration file
const migrationPath = path.join(__dirname, '../supabase/migrations/20251122000002_create_domains_table.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

console.log('📦 Running database migration...');
console.log('Migration file:', migrationPath);
console.log('');

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Split SQL into individual statements
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

async function runMigration() {
  console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

  try {
    // Execute each statement via Supabase RPC
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      // Skip comments
      if (statement.trim().startsWith('COMMENT ON')) {
        console.log(`⏭️  Skipping comment ${i + 1}/${statements.length}`);
        continue;
      }

      console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`);

      const { error } = await supabase.rpc('exec_sql', {
        sql: statement
      });

      if (error) {
        console.error(`❌ Error in statement ${i + 1}:`, error.message);
        console.log('\n📝 Trying alternative approach...\n');
        throw error;
      }

      console.log(`✅ Statement ${i + 1} completed`);
    }

    console.log('\n✅ All migration statements completed successfully!');
    console.log('\n📊 Created:');
    console.log('  - domains table');
    console.log('  - merchants.slug column');
    console.log('  - RLS policies');
    console.log('  - Triggers and functions');

  } catch (error) {
    console.error('\n❌ Migration failed via Supabase client');
    console.log('\n📝 Please run the migration manually:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🌐 Option 1: Supabase Dashboard (Recommended)');
    console.log('1. Go to: https://supabase.com/dashboard/project/aivqthbxdshhltbwipbr/editor');
    console.log('2. Click "SQL Editor" in the left sidebar');
    console.log('3. Click "New Query"');
    console.log('4. Copy and paste the entire contents from:');
    console.log('   📄', migrationPath);
    console.log('5. Click "Run" button');
    console.log('\n💻 Option 2: Copy SQL directly');
    console.log('The SQL migration is ready in:');
    console.log('   📄', migrationPath);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(1);
  }
}

runMigration();
