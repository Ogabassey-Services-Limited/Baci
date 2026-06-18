import {
  loadReceiptClaimPreview,
  parseReceiptClaimToken,
} from '@/lib/import-notifications/receipt-claim-preview';
import { createClient } from '@/lib/supabase/server';
import ReceiptClaimPageClient from './receipt-claim-page-client';

interface ReceiptClaimPageProps {
  params: Promise<{ token: string }>;
}

export default async function ReceiptClaimPage({
  params,
}: ReceiptClaimPageProps) {
  const { token: rawToken } = await params;
  const token = parseReceiptClaimToken(rawToken);

  if (!token) {
    return (
      <ReceiptClaimPageClient
        initialClaim={null}
        initialError="Invalid receipt claim link"
        token=""
      />
    );
  }

  try {
    const supabase = await createClient();
    const preview = await loadReceiptClaimPreview({ supabase, token });

    return (
      <ReceiptClaimPageClient
        initialClaim={preview.ok ? preview.claim : null}
        initialError={preview.ok ? null : preview.error}
        token={token}
      />
    );
  } catch (error) {
    console.error('Failed to load receipt claim', error);

    return (
      <ReceiptClaimPageClient
        initialClaim={null}
        initialError="Failed to load receipt claim"
        token={token}
      />
    );
  }
}
