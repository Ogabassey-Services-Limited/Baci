import type { Dispatch, SetStateAction } from 'react';
import { useRef } from 'react';
import type { useBlogAutoSave } from '@/hooks/use-blog-auto-save';
import type { useToast } from '@/hooks/use-toast';
import {
  INITIAL_FORM_DATA,
  withFeaturedImageDefaults,
} from './edit-blog-form-data';
import type { PostFormData } from './edit-blog-types';

type DraftPersistence = Pick<
  ReturnType<typeof useBlogAutoSave>,
  'clearSavedData' | 'getSavedData' | 'hasSavedData'
>;

export function useEditBlogDraftRecovery({
  persistence,
  setEditorResetKey,
  setFormData,
  toast,
}: {
  persistence: DraftPersistence;
  setEditorResetKey: Dispatch<SetStateAction<number>>;
  setFormData: Dispatch<SetStateAction<PostFormData>>;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const hasCheckedForRecovery = useRef(false);

  return (loadedFormData: PostFormData | null) => {
    if (!persistence.hasSavedData() || hasCheckedForRecovery.current) {
      return;
    }
    hasCheckedForRecovery.current = true;
    const saved = persistence.getSavedData();
    if (!saved) return;
    const previousData = loadedFormData ?? { ...INITIAL_FORM_DATA };
    setFormData(withFeaturedImageDefaults(saved.data as PostFormData));
    setEditorResetKey((key) => key + 1);
    toast({
      title: 'Draft Recovered',
      description: 'Your unsaved changes have been restored.',
      action: (
        <button
          type="button"
          onClick={() => {
            setFormData(previousData);
            setEditorResetKey((key) => key + 1);
            persistence.clearSavedData();
            toast({
              title: 'Recovery Undone',
              description: 'Restored to the last saved version.',
            });
          }}
          className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
        >
          Undo
        </button>
      ),
      duration: 8000,
    });
  };
}
