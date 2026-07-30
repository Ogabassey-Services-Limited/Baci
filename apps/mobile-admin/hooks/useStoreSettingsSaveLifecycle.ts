import { type QueryClient, useMutation } from '@tanstack/react-query';
import { type Dispatch, type SetStateAction, useRef } from 'react';
import {
  buildMerchantUpdatePayload,
  type StoreSettingsFormValues,
} from '@/components/store-settings/store-settings-payload';
import type { StatusModalState } from '@/components/ui/StatusModal';
import type { Merchant } from '@/hooks/useMerchant';
import {
  type MerchantIdentitySettingsReceipt,
  updateMerchantIdentitySettings,
} from '@/lib/merchant-settings';
import { invalidateStoreSettingsAfterSave } from '@/lib/store-settings-save-readiness';

type StoreSettingsSaveToken = {
  merchantId: string;
  receipt: MerchantIdentitySettingsReceipt | null;
  revision: number;
};

export type RefreshedLocalStoreSettingsSave = MerchantIdentitySettingsReceipt;

type StoreSettingsRouter = {
  back: () => void;
};

type UseStoreSettingsSaveLifecycleArgs = {
  baseline: StoreSettingsFormValues | null;
  formValues: StoreSettingsFormValues;
  from?: string;
  getFormRevision: () => number;
  merchant: Pick<Merchant, 'id' | 'updated_at'> | null | undefined;
  onRefreshedLocalSave: (save: RefreshedLocalStoreSettingsSave) => void;
  queryClient: QueryClient;
  resetFormDirty: () => void;
  router: StoreSettingsRouter;
  setStatusModal: Dispatch<SetStateAction<StatusModalState>>;
  syncedMerchantUpdatedAt: string | null | undefined;
};

/** Saves settings without applying an old merchant's result to the active form. */
export function useStoreSettingsSaveLifecycle({
  baseline,
  formValues,
  from,
  getFormRevision,
  merchant,
  onRefreshedLocalSave,
  queryClient,
  resetFormDirty,
  router,
  setStatusModal,
  syncedMerchantUpdatedAt,
}: UseStoreSettingsSaveLifecycleArgs) {
  const merchantIdRef = useRef<string | null>(merchant?.id ?? null);
  const activeSaveTokenRef = useRef<StoreSettingsSaveToken | null>(null);
  merchantIdRef.current = merchant?.id ?? null;

  const isCurrentSaveToken = (
    saveToken: StoreSettingsSaveToken | null | undefined
  ) =>
    Boolean(
      saveToken &&
        merchantIdRef.current === saveToken.merchantId &&
        getFormRevision() === saveToken.revision
    );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!merchant?.id || !baseline) throw new Error('No merchant found');

      const payload = buildMerchantUpdatePayload(baseline, formValues);
      const saveToken = {
        merchantId: merchant.id,
        receipt: null,
        revision: getFormRevision(),
      };
      activeSaveTokenRef.current = saveToken;
      if (Object.keys(payload).length === 0) return saveToken;

      if (!syncedMerchantUpdatedAt) {
        throw new Error(
          'These settings need to be reloaded before they can be saved.'
        );
      }
      const receipt = await updateMerchantIdentitySettings({
        expectedUpdatedAt: syncedMerchantUpdatedAt,
        merchantId: merchant.id,
        settings: payload,
      });
      return { ...saveToken, receipt };
    },
    onSuccess: async (saveToken) => {
      await invalidateStoreSettingsAfterSave(
        queryClient,
        saveToken?.merchantId
      );
      if (
        saveToken?.receipt &&
        merchantIdRef.current === saveToken.receipt.merchantId
      ) {
        onRefreshedLocalSave(saveToken.receipt);
      }
      if (!isCurrentSaveToken(saveToken)) {
        activeSaveTokenRef.current = null;
        return;
      }
      resetFormDirty();
      if (from === 'setup') {
        router.back();
        return;
      }
      setStatusModal({
        visible: true,
        type: 'success',
        title: 'Success!',
        message: 'Store settings updated successfully.',
      });
    },
    onError: (error: unknown) => {
      const isCurrentSave = isCurrentSaveToken(activeSaveTokenRef.current);
      activeSaveTokenRef.current = null;
      if (!isCurrentSave) return;
      console.error('Update error:', error);
      setStatusModal({
        visible: true,
        type: 'error',
        title: 'Update Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update store settings',
      });
    },
  });

  const handleCloseStatusModal = (statusModal: StatusModalState) => {
    if (statusModal.type === 'success' && statusModal.title === 'Success!') {
      setStatusModal((previous) => ({ ...previous, visible: false }));
      if (isCurrentSaveToken(activeSaveTokenRef.current)) router.back();
      activeSaveTokenRef.current = null;
      return;
    }
    setStatusModal((previous) => ({ ...previous, visible: false }));
  };

  return { handleCloseStatusModal, saveMutation };
}
