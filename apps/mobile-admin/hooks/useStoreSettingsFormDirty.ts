import { useRef, useState } from 'react';

/** Tracks whether store settings contain edits that must survive query refetches. */
export function useStoreSettingsFormDirty() {
  const [isFormDirty, setIsFormDirty] = useState(false);
  const formRevision = useRef(0);

  return {
    isFormDirty,
    getFormRevision: () => formRevision.current,
    markFormDirty: () => {
      formRevision.current += 1;
      setIsFormDirty(true);
    },
    resetFormDirty: () => setIsFormDirty(false),
  };
}
