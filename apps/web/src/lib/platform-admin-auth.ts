import { unstable_rethrow } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export type PlatformAdminAuth =
  | { status: 'authenticated'; user: { email: string | null; id: string } }
  | { status: 'forbidden' }
  | { status: 'unauthenticated' };

export async function getPlatformAdminAuth(): Promise<PlatformAdminAuth> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { status: 'unauthenticated' };
    }

    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('is_platform_admin')
      .eq('user_id', user.id)
      .maybeSingle();

    if (merchantError || merchant?.is_platform_admin !== true) {
      return { status: 'forbidden' };
    }

    return {
      status: 'authenticated',
      user: {
        email: user.email ?? null,
        id: user.id,
      },
    };
  } catch (error) {
    unstable_rethrow(error);
    return { status: 'unauthenticated' };
  }
}
