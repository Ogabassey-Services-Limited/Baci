import type { Dispatch, SetStateAction, TransitionStartFunction } from 'react';
import type { useMerchant } from '@/hooks/use-merchant-client';
import type { CachedMerchant } from '@/lib/cached-data';
import { logger } from '@/lib/logger';
import { extractColorsFromImage } from './settings-utils';

type UpdateMerchant = ReturnType<typeof useMerchant>['updateMerchant'];

type Toast = (options: {
  title: string;
  description: string;
  variant?: 'destructive';
}) => void;

interface LogoUploadContext {
  dataUri: string;
  merchantId: string;
  previousState: CachedMerchant;
  updateMerchant: UpdateMerchant;
  toast: Toast;
  setMerchantState: Dispatch<SetStateAction<CachedMerchant>>;
  setIsUploading: Dispatch<SetStateAction<boolean>>;
  startTransition: TransitionStartFunction;
}

export async function uploadLogoWithColors({
  dataUri,
  merchantId,
  previousState,
  updateMerchant,
  toast,
  setMerchantState,
  setIsUploading,
  startTransition,
}: LogoUploadContext) {
  setIsUploading(true);
  try {
    startTransition(() => {
      setMerchantState((previousMerchant) => ({
        ...previousMerchant,
        logo_url: dataUri,
      }));
    });

    const newColors = await extractColorsFromImage(dataUri);
    const { uploadImage } = await import('@/lib/storage');
    const uploadedUrl = await uploadImage(dataUri);

    if (!uploadedUrl) throw new Error('Failed to upload logo to storage.');

    await updateMerchant(
      {
        logo_url: uploadedUrl,
        brand_colors: newColors,
      },
      { merchantId, skipReload: true }
    );

    startTransition(() => {
      setMerchantState((previousMerchant) => ({
        ...previousMerchant,
        logo_url: uploadedUrl,
        brand_colors: newColors,
      }));
    });

    toast({
      title: 'Logo and Colors Updated!',
      description: 'Your new brand identity is saved.',
    });
  } catch (error) {
    setMerchantState(previousState);
    logger.error({
      error: error as Error,
      message: 'Logo upload and color extraction failed.',
    });
    toast({
      title: 'Update Failed',
      description: (error as Error).message,
      variant: 'destructive',
    });
  } finally {
    setIsUploading(false);
  }
}
