import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Checks whether the database migration that adds `merchants.social_media` (and removes legacy product columns) has been applied, and returns status information or manual migration instructions.
 *
 * @param request - Incoming HTTP request (unused but required by the route handler signature).
 * @returns A JSON response describing the migration status:
 * - When the migration has been applied: `{ status: 'applied', message: string, details: { social_media_column_exists: boolean, old_columns_dropped: boolean } }`.
 * - When the `social_media` column is missing: `{ status: 'not_applied', message: string, instructions: string }` with a multi-line SQL remediation block.
 * - When Supabase configuration is missing: `{ error: 'Missing Supabase configuration' }`.
 * - On unexpected failure: `{ error: 'Failed to check migration status', details: string }`.
 */
export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if migration has been applied by querying for social_media column
    const { error: checkError } = await supabase
      .from('merchants')
      .select('social_media')
      .limit(1);

    if (checkError) {
      if (checkError.message.includes('column') && checkError.message.includes('social_media')) {
        return NextResponse.json({
          status: 'not_applied',
          message: 'Migration has not been applied yet.',
          instructions: `
The migration needs to be applied manually via the Supabase SQL Editor:

1. Go to: https://supabase.com/dashboard/project/aivqthbxdshhltbwipbr/sql/new
2. Copy and paste the SQL from: supabase/migrations/20251125180000_social_media_and_cleanup.sql
3. Click "Run"

This migration will:
- Add social_media JSONB column to merchants table
- Drop old product columns (image_small, image_large, is_active)
- Update RLS policies to use status instead of is_active
          `,
        });
      }
      throw checkError;
    }

    // Check if old columns still exist by trying to select them
    const { error: oldColumnsError } = await supabase
      .from('products')
      .select('is_active')
      .limit(1);

    const oldColumnsExist = !oldColumnsError;

    return NextResponse.json({
      status: 'applied',
      message: 'Migration has been applied successfully!',
      details: {
        social_media_column_exists: true,
        old_columns_dropped: !oldColumnsExist,
      },
    });
  } catch (error) {
    console.error('Migration check error:', error);
    return NextResponse.json(
      { error: 'Failed to check migration status', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Informational endpoint that directs clients to use POST for migration status checks.
 *
 * @returns A JSON object containing a `message` advising to use POST to check migration status
 */
export async function GET() {
  return NextResponse.json({
    message: 'Use POST to check migration status',
  });
}