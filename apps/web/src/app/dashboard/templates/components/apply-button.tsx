'use client';

import { CheckCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type MouseEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';

interface ApplyTemplateButtonProps {
  templateId: string;
  size?: 'default' | 'sm';
}

export function ApplyTemplateButton({
  templateId,
  size = 'default',
}: ApplyTemplateButtonProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isActivating, setIsActivating] = useState(false);
  const { updateMerchant } = useMerchant();

  const handleApply = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsActivating(true);

    try {
      await updateMerchant({ template_id: templateId });

      router.refresh(); // Invalidate server cache to ensure storefront updates

      toast({
        title: 'Template Applied!',
        description: 'Your store is now using this new template.',
      });

      // Brief delay to ensure toast is visible before navigation
      await new Promise((resolve) => setTimeout(resolve, 500));
      router.push('/dashboard/settings');
    } catch (error) {
      console.error('Template apply error:', error);
      toast({
        title: 'Failed to Apply',
        description:
          error instanceof Error
            ? error.message
            : 'Could not apply template. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <Button
      size={size}
      className="bg-green-700 hover:bg-green-800 text-white shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-700"
      onClick={handleApply}
      disabled={isActivating}
      aria-label={isActivating ? 'Applying template...' : 'Apply this template'}
    >
      {isActivating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle className="mr-2 h-4 w-4" />
      )}
      {isActivating ? 'Applying...' : 'Apply'}
    </Button>
  );
}
