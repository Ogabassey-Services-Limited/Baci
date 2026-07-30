import { useState } from 'react';

/** Tracks whether store settings contain edits that must survive query refetches. */
export function useStoreSettingsFormDirty() {
  const [isFormDirty, setIsFormDirty] = useState(false);

  return {
    isFormDirty,
    markFormDirty: () => setIsFormDirty(true),
    resetFormDirty: () => setIsFormDirty(false),
  };
}
