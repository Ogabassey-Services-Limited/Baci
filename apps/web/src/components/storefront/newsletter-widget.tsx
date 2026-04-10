'use client';

import { Gift, Loader2, Mail, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ThemedButton } from '@/components/themed';
import { Input } from '@/components/ui/input';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const NEWSLETTER_DISMISSED_KEY = 'baci-newsletter-dismissed';
const NEWSLETTER_SUBSCRIBED_KEY = 'baci-newsletter-subscribed';

interface NewsletterWidgetProps {
  /**
   * Delay in milliseconds before showing the widget
   * @default 5000
   */
  showDelay?: number;
  /**
   * Position of the widget
   * @default 'bottom-left'
   */
  position?: 'bottom-left' | 'bottom-right';
  /**
   * Custom discount offer text
   * @default '10% OFF'
   */
  discountText?: string;
}

export function NewsletterWidget({
  showDelay = 5000,
  position = 'bottom-left',
  discountText = '10% OFF',
}: NewsletterWidgetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { toast } = useToast();
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant;

  useEffect(() => {
    // Check if already subscribed or dismissed
    const dismissed = localStorage.getItem(NEWSLETTER_DISMISSED_KEY);
    const subscribed = localStorage.getItem(NEWSLETTER_SUBSCRIBED_KEY);

    if (subscribed) {
      setIsSubscribed(true);
      return;
    }

    if (dismissed) {
      // Check if dismissal was more than 7 days ago
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed =
        (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Show widget after delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, showDelay);

    return () => clearTimeout(timer);
  }, [showDelay]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(NEWSLETTER_DISMISSED_KEY, new Date().toISOString());
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleExpand = () => {
    setIsMinimized(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email?.includes('@')) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit to API
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          merchantId: merchant?.id,
          source: 'widget',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to subscribe');
      }

      setIsSubscribed(true);
      localStorage.setItem(NEWSLETTER_SUBSCRIBED_KEY, 'true');

      toast({
        title: 'Welcome!',
        description:
          'Thank you for subscribing. Check your email for your discount code!',
      });
    } catch {
      toast({
        title: 'Subscription failed',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVisible || isSubscribed) return null;

  const positionClasses = {
    'bottom-left': 'left-4 bottom-32',
    'bottom-right': 'right-4 bottom-32',
  };

  // Minimized state - small floating button
  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={handleExpand}
        className={cn(
          'fixed z-40 w-12 h-12 rounded-full shadow-lg',
          'bg-primary text-primary-foreground',
          'flex items-center justify-center',
          'animate-in fade-in slide-in-from-bottom-4 duration-300',
          'hover:scale-110 transition-transform',
          'will-change-transform',
          positionClasses[position]
        )}
        style={{
          backgroundColor: 'var(--store-primary, hsl(var(--primary)))',
          color: 'var(--store-primary-text, hsl(var(--primary-foreground)))',
          contain: 'layout style paint',
        }}
        aria-label="Open newsletter signup"
      >
        <Gift className="w-5 h-5" />
      </button>
    );
  }

  // Full widget
  return (
    <aside
      className={cn(
        'fixed z-40 w-80 max-w-[calc(100vw-2rem)]',
        'bg-background border border-border rounded-xl shadow-xl',
        'animate-in fade-in slide-in-from-bottom-4 duration-300',
        'will-change-transform',
        positionClasses[position]
      )}
      style={{
        contain: 'layout style paint',
      }}
      aria-label="Newsletter signup"
    >
      {/* Close and minimize buttons */}
      <div className="absolute top-2 right-2 flex gap-1">
        <button
          type="button"
          onClick={handleMinimize}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Minimize"
        >
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 12H4"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close newsletter signup"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5">
        {/* Header with gift icon */}
        <div className="text-center mb-4">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
            style={{
              backgroundColor: 'var(--store-accent, hsl(var(--accent)))',
              color: 'var(--store-accent-text, hsl(var(--accent-foreground)))',
            }}
          >
            <Gift className="w-6 h-6" />
          </div>
          <h3
            className="text-lg font-bold"
            style={{ color: 'var(--store-primary, hsl(var(--foreground)))' }}
          >
            Get {discountText} your first order!
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Subscribe to our newsletter for exclusive deals and updates.
          </p>
        </div>

        {/* Subscription form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
              disabled={isSubmitting}
              required
            />
          </div>
          <ThemedButton
            type="submit"
            colorRole="accent"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Subscribing...
              </>
            ) : (
              'Get My Discount'
            )}
          </ThemedButton>
        </form>

        {/* Privacy note */}
        <p className="text-xs text-muted-foreground text-center mt-3">
          No spam, unsubscribe anytime.
        </p>
      </div>
    </aside>
  );
}
