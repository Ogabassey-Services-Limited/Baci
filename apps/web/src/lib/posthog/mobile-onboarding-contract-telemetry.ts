import { getPostHogReleaseContext } from '@/lib/posthog/config';
import { captureServerEvent } from '@/lib/posthog/server';

export type MobileOnboardingContract = 'v1_legacy' | 'v2_authenticated';

export async function recordMobileOnboardingContractInvocation(
  contract: MobileOnboardingContract
): Promise<void> {
  const properties = {
    contract,
    ...getPostHogReleaseContext(process.env),
  };
  const captured = await captureServerEvent(
    'mobile_onboarding_contract_invoked',
    properties
  );

  if (!captured) {
    console.warn(
      'mobile_onboarding_contract_telemetry_gap %s',
      JSON.stringify(properties)
    );
  }
}
