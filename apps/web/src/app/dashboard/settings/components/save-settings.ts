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
  merchantId: string;
  socialMedia: Record<string, string> | null;
  updateMerchant: UpdateMerchantFn;
  /** Deliberately not invoked: this callback reloads the implicit merchant. */
  reloadMerchant: () => void;
  isCurrentSave: () => boolean;
  toast: ToastFn;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
}

export async function saveSettings({
  data,
  heroSlides,
  merchantId,
  socialMedia,
  updateMerchant,
  isCurrentSave,
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
      await updateSocial(merchantId, sanitizeSocialMedia(socialMedia));
    }

    // Generic settings use the captured merchant target. The explicit update
    // patches only a matching context, so selected merchant B can never be
    // replaced by the implicit owner's merchant A after the save completes.
    await updateMerchant(
      {
        ...data,
        hero_slides: heroSlides,
      } as Parameters<UpdateMerchantFn>[0],
      { merchantId, skipReload: true }
    );
    if (isCurrentSave()) {
      toast({
        title: 'Settings Saved!',
        description: 'Your store settings have been updated.',
      });
    }
  } catch (error) {
    if (isCurrentSave()) {
      toast({
        title: 'Error Saving Settings',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  } finally {
    if (isCurrentSave()) setIsSaving(false);
  }
}
