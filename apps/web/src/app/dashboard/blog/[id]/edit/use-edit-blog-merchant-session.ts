import {
  type Dispatch,
  type SetStateAction,
  useLayoutEffect,
  useRef,
} from 'react';

export function useEditBlogSession(
  merchantId: string | undefined,
  postId: string,
  setIsSaving: Dispatch<SetStateAction<boolean>>
) {
  const merchantSessionRef = useRef({ generation: 0, merchantId, postId });
  useLayoutEffect(() => {
    const session = merchantSessionRef.current;
    if (session.merchantId === merchantId && session.postId === postId) return;
    merchantSessionRef.current = {
      generation: session.generation + 1,
      merchantId,
      postId,
    };
    setIsSaving(false);
  }, [merchantId, postId, setIsSaving]);

  return merchantSessionRef;
}
