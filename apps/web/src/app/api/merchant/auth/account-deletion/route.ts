import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Handle account deletion request.
 * Requirement: Apple App Review Guideline 5.1.1(v)
 */
export async function POST() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 1. Verify user authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const adminSupabase = createAdminClient();

    // 2. Delete the user from auth.users
    // DB Cascades (updated via migration) will handle:
    // - public.merchants (if owner)
    // - public.staff_members
    // - public.audit_logs
    // - public.feedback
    // - etc.
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(
      user.id
    );

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to delete account',
      },
      { status: 500 }
    );
  }
}
