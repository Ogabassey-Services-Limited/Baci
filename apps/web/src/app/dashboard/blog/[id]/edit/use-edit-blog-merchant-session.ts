import {
  type Dispatch,
  type SetStateAction,
  useLayoutEffect,
  useRef,
} from 'react';

export function useEditBlogSession(
  merchantId: string | undefined,
  setIsSaving: Dispatch<SetStateAction<boolean>>
) {
  const merchantSessionRef = useRef({ generation: 0, id: merchantId });
  useLayoutEffect(() => {
    if (merchantSessionRef.current.id === merchantId) return;
    merchantSessionRef.current = {
      generation: merchantSessionRef.current.generation + 1,
      id: merchantId,
    };
    setIsSaving(false);
  }, [merchantId, setIsSaving]);

  return merchantSessionRef;
}
