const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Checks whether the merchants.social_media migration has been applied; if not, reads and prints the migration SQL along with manual apply instructions.
 *
 * This function may print diagnostic messages and, on unexpected errors, will log the error and exit the process with code 1.
 *
 * @returns {boolean} `true` if the `social_media` column exists, `false` if the migration appears missing and the migration SQL was printed.
 */
async function checkAndApplyMigration() {
  try {
    console.log('Checking if migration has been applied...');

    // Try to query for social_media column
    const { error } = await supabase
      .from('merchants')
      .select('social_media')
      .limit(1);

    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log('Migration not applied yet. Reading migration file...');

        // Read the migration file
        const migrationPath = path.join(__dirname, '../supabase/migrations/20251125180000_social_media_and_cleanup.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('Applying migration...');
        console.log('\nNote: This script uses the anon key which may not have permissions to run DDL statements.');
        console.log('You may need to run this migration directly in the Supabase SQL Editor.');
        console.log('\nMigration SQL:\n');
        console.log(migrationSQL);
        console.log('\n--- To apply this migration ---');
        console.log('1. Go to https://aivqthbxdshhltbwipbr.supabase.co/project/aivqthbxdshhltbwipbr/sql/new');
        console.log('2. Copy and paste the SQL above');
        console.log('3. Click "Run"');

        return false;
      } else {
        throw error;
      }
    } else {
      console.log('✓ Migration already applied! social_media column exists.');
      return true;
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAndApplyMigration()
  .then((applied) => {
    if (applied) {
      console.log('\nAll set! The database schema is up to date.');
    }
    process.exit(0);
  });