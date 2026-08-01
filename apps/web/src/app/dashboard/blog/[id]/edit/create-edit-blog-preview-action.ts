import type { useToast } from '@/hooks/use-toast';
import { getPreviewUrl } from '../../actions';
import type { PostFormData } from './edit-blog-types';

type Toast = ReturnType<typeof useToast>['toast'];

export function createEditBlogPreviewAction({
  merchantSessionRef,
  merchantSlug,
  postSlug,
  savePost,
  toast,
}: {
  merchantSessionRef: { current: object };
  merchantSlug: string | undefined;
  postSlug: string;
  savePost: (status?: PostFormData['status']) => Promise<boolean>;
  toast: Toast;
}) {
  return async () => {
    const previewMerchantSession = merchantSessionRef.current;
    if (!merchantSlug) {
      toast({
        title: 'Error',
        description: 'Merchant slug not found.',
        variant: 'destructive',
      });
      return;
    }
    if (!(await savePost('draft'))) return;
    try {
      const previewUrl = await getPreviewUrl(merchantSlug, postSlug);
      if (merchantSessionRef.current !== previewMerchantSession) return;
      window.open(previewUrl, '_blank');
    } catch (error) {
      if (merchantSessionRef.current !== previewMerchantSession) return;
      console.error('Error getting preview URL:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate preview link.',
        variant: 'destructive',
      });
    }
  };
}
