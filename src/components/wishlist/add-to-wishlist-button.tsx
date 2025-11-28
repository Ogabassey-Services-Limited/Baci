'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { HeartIcon, LoadingSpinner } from '@/components/ui/animated-icons';

interface AddToWishListButtonProps {
  productId: string;
  merchantId: string;
  customerEmail: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showText?: boolean;
  className?: string;
}

export function AddToWishListButton({
  productId,
  merchantId,
  customerEmail,
  variant = 'ghost',
  size = 'icon',
  showText = false,
  className,
}: AddToWishListButtonProps) {
  const { toast } = useToast();
  const [inWishList, setInWishList] = useState(false);
  const [wishListItemId, setWishListItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkWishListStatus = useCallback(async () => {
    if (!customerEmail) {
      setIsChecking(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/wishlist/check?email=${encodeURIComponent(customerEmail)}&productId=${productId}`
      );
      if (response.ok) {
        const data = await response.json();
        setInWishList(data.inWishList);
        setWishListItemId(data.itemId);
      }
    } catch (error) {
      console.error('Error checking wish list status:', error);
    } finally {
      setIsChecking(false);
    }
  }, [customerEmail, productId]);

  // Check if product is already in wish list on mount
  useEffect(() => {
    checkWishListStatus();
  }, [checkWishListStatus]);

  const handleToggleWishList = async () => {
    if (!customerEmail) {
      toast({
        title: 'Email Required',
        description: 'Please provide your email to save items to your wish list.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      if (inWishList && wishListItemId) {
        // Remove from wish list
        const response = await fetch(`/api/wishlist?id=${wishListItemId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to remove from wish list');
        }

        setInWishList(false);
        setWishListItemId(null);
        toast({
          title: 'Removed from Wish List',
          description: 'Item has been removed from your wish list.',
        });
      } else {
        // Add to wish list
        const response = await fetch('/api/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerEmail,
            productId,
            merchantId,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          if (error.error === 'Item already in wish list') {
            // Refresh status
            await checkWishListStatus();
            return;
          }
          throw new Error(error.error || 'Failed to add to wish list');
        }

        const data = await response.json();
        setInWishList(true);
        setWishListItemId(data.item.id);
        toast({
          title: 'Added to Wish List',
          description: 'Item has been saved to your wish list.',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <Button variant={variant} size={size} disabled className={className}>
        <LoadingSpinner size={16} />
        {showText && <span className="ml-2">Loading...</span>}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggleWishList}
      disabled={isLoading}
      className={cn(className)}
      aria-label={inWishList ? 'Remove from wish list' : 'Add to wish list'}
    >
      {isLoading ? (
        <LoadingSpinner size={16} />
      ) : (
        <HeartIcon
          liked={inWishList}
          size={16}
          onToggle={undefined}
        />
      )}
      {showText && (
        <span className="ml-2">
          {inWishList ? 'Saved' : 'Save'}
        </span>
      )}
    </Button>
  );
}
