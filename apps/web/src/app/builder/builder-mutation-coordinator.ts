export interface BuilderMutationCoordinator {
  finish: (isCurrentRequest: () => boolean) => void;
  start: (merchantId: string) => (() => boolean) | null;
  synchronizeMerchant: (merchantId: string | null) => void;
}

export function createBuilderMutationCoordinator(
  initialMerchantId: string | null
): BuilderMutationCoordinator {
  let currentMerchantId = initialMerchantId;
  let pending = false;
  let revision = 0;

  function synchronizeMerchant(merchantId: string | null) {
    if (currentMerchantId === merchantId) return;
    currentMerchantId = merchantId;
    revision += 1;
    pending = false;
  }

  function start(merchantId: string) {
    if (pending || currentMerchantId !== merchantId) return null;
    pending = true;
    const requestRevision = ++revision;
    return () =>
      currentMerchantId === merchantId && revision === requestRevision;
  }

  function finish(isCurrentRequest: () => boolean) {
    if (isCurrentRequest()) {
      pending = false;
    }
  }

  return { finish, start, synchronizeMerchant };
}
