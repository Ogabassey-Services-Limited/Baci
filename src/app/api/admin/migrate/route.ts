import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Extract Supabase project reference from URL for dashboard links
 */
function getProjectRef(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] || null;
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Step 1: Authentication check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Admin role check
    const { data: merchant } = await supabase
      .from('merchants')
      .select('is_platform_admin')
      .eq('user_id', user.id)
      .single();

    if (!merchant?.is_platform_admin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Check if migration has been applied by querying for social_media column
    const { error: checkError } = await supabase
      .from('merchants')
      .select('social_media')
      .limit(1);

    const projectRef = getProjectRef();
    const dashboardUrl = projectRef
      ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
      : 'https://supabase.com/dashboard (find your project)';

    if (checkError) {
      if (
        checkError.message.includes('column') &&
        checkError.message.includes('social_media')
      ) {
        return NextResponse.json({
          status: 'not_applied',
          message: 'Migration has not been applied yet.',
          instructions: `
The migration needs to be applied manually via the Supabase SQL Editor:

1. Go to: ${dashboardUrl}
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
      { error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message:
      'Use POST to check migration status (requires admin authentication)',
  });
}
