import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const { data: checkData, error: checkError } = await supabase
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

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to check migration status',
  });
}
