'use client';

import type { MerchantTrustProfileDraft } from '../../../../../../../packages/shared/src/contracts/merchant-trust-profile';
import { TrustSettingsForm } from './trust-settings-form';

interface TrustSettingsClientProps {
  merchantId: string;
  initialTrustProfile: MerchantTrustProfileDraft | null;
}

export function TrustSettingsClient({
  merchantId,
  initialTrustProfile,
}: TrustSettingsClientProps) {
  return (
    <TrustSettingsForm
      key={merchantId}
      merchantId={merchantId}
      initialTrustProfile={initialTrustProfile}
    />
  );
}
