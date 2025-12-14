'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function setPrimaryDomain(domain: string) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get merchant ID
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      throw new Error('Merchant not found');
    }

    // Verify domain belongs to merchant and verify it is active
    const { data: domainRecord, error: domainError } = await supabase
      .from('domains')
      .select('id, status')
      .eq('domain', domain)
      .eq('merchant_id', merchant.id)
      .single();

    if (domainError || !domainRecord) {
      throw new Error('Domain not found or access denied');
    }

    if (domainRecord.status !== 'active') {
      throw new Error('Only active domains can be set as primary');
    }

    // Update domain to be primary
    // The database trigger will handle unsetting other primary domains
    const { error: updateError } = await supabase
      .from('domains')
      .update({ is_primary: true })
      .eq('id', domainRecord.id);

    if (updateError) {
      throw new Error('Failed to set primary domain');
    }

    // Revalidate the domains page to show the updated primary status immediately
    revalidatePath('/dashboard/domains');

    return { success: true };
  } catch (error: unknown) {
    console.error('Error setting primary domain:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update domain',
    };
  }
}
