import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { createClient } from '@/lib/supabase/server';

/**
 * Handle account deletion request.
 * Requirement: Apple App Review Guideline 5.1.1(v)
 */
export async function POST(request: NextRequest) {
  // 1. Verify user authentication FIRST (project convention)
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. CSRF protection
  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  try {
    // 3. Delete the user from auth.users via secure RPC
    // DB Cascades (updated via migration) will handle related data.
    const { error: deleteError } = await supabase.rpc('delete_current_user');

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
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
