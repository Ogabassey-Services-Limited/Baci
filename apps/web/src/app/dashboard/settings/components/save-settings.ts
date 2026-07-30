import type { Dispatch, SetStateAction } from 'react';
import { updateSocial } from '@/hooks/merchant/update-social';
import type { useMerchant } from '@/hooks/use-merchant-client';
import type { useToast } from '@/hooks/use-toast';
import type { HeroSlide } from '@/lib/cached-data';
import { type SettingsFormValues, sanitizeSocialMedia } from './settings-utils';

type UpdateMerchantFn = ReturnType<typeof useMerchant>['updateMerchant'];
type ToastFn = (
  props: Parameters<ReturnType<typeof useToast>['toast']>[0]
) => unknown;

interface SaveSettingsContext {
  data: SettingsFormValues;
  heroSlides: HeroSlide[];
  socialMedia: Record<string, string> | null;
  updateMerchant: UpdateMerchantFn;
  reloadMerchant: () => void;
  toast: ToastFn;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
}

export async function saveSettings({
  data,
  heroSlides,
  socialMedia,
  updateMerchant,
  reloadMerchant,
  toast,
  setIsSaving,
}: SaveSettingsContext) {
  setIsSaving(true);
  try {
    // Commit the guarded identity write first. If reauthentication or server
    // validation rejects it, no generic settings have been partially saved.
    // A null draft means the user did not edit social links, so no identity
    // request is needed at all.
    if (socialMedia !== null) {
      await updateSocial(sanitizeSocialMedia(socialMedia));
    }

    // Generic (non-identity) settings go through the generic hook. Suppress
    // its implicit reload so the context refresh happens once after both
    // ordered writes have committed.
    await updateMerchant(
      {
        ...data,
        hero_slides: heroSlides,
      } as Parameters<UpdateMerchantFn>[0],
      { skipReload: true }
    );
    reloadMerchant();
    toast({
      title: 'Settings Saved!',
      description: 'Your store settings have been updated.',
    });
  } catch (error) {
    toast({
      title: 'Error Saving Settings',
      description: (error as Error).message,
      variant: 'destructive',
    });
  } finally {
    setIsSaving(false);
  }
}
