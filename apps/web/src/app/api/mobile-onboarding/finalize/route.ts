import { cookies } from 'next/headers';
import { after, NextResponse } from 'next/server';
import { env } from '@/env';
import { readMobileOnboardingMetadata } from '@/lib/mobile-onboarding/metadata';
import { provisionMobileOnboarding } from '@/lib/mobile-onboarding/provision';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

// CSRF exempt: This endpoint is called by the mobile app with Bearer auth
// after email verification or login. It does not rely on browser cookies.
export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      throw authError;
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const metadataResult = readMobileOnboardingMetadata(user);
    if (!metadataResult.success) {
      return NextResponse.json(
        {
          error: metadataResult.error,
          code: 'PROFILE_INCOMPLETE',
        },
        { status: 409 }
      );
    }

    const result = await provisionMobileOnboarding({
      supabase,
      user: {
        id: user.id,
        email: user.email ?? metadataResult.data.email,
      },
      profile: metadataResult.data,
      rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
      defer: after,
    });

    if (!result.success) {
      return NextResponse.json(result.body, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errName = error instanceof Error ? error.name : typeof error;
    const errStack =
      error instanceof Error
        ? error.stack?.split('\n').slice(0, 3).join(' | ')
        : undefined;

    console.error(
      'Mobile onboarding finalize error:',
      JSON.stringify({ name: errName, message: errMsg, stack: errStack })
    );

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
