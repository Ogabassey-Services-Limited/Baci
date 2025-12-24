'use client';

import { Loader2, Mail } from 'lucide-react';
import { useState } from 'react';
// import { cn } from '@/lib/utils';
import { ThemedButton } from '@/components/themed';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';

export interface NewsletterProps {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  placeholder?: string;
  backgroundColor?: string;
  textColor?: string;
  merchantId?: string;
}

export function Newsletter({
  title = 'Subscribe to our newsletter',
  subtitle = 'Get the latest updates on new products and upcoming sales.',
  buttonText = 'Subscribe',
  placeholder = 'Enter your email address',
  backgroundColor = '#f9fafb',
  textColor = '#111827',
  merchantId: propMerchantId,
}: NewsletterProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const merchantContext = useMerchantSafe();

  // Determine merchant ID from props or context
  const merchantId = propMerchantId || merchantContext?.merchant?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          merchantId,
          source: 'widget',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to subscribe');
      }

      toast({
        title: 'Success!',
        description:
          data.message || 'You have been subscribed to the newsletter.',
        variant: 'default',
      });

      setEmail('');
    } catch (error) {
      console.error('Newsletter subscription error:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className="py-16 px-4"
      style={{ backgroundColor, color: textColor }}
    >
      <div className="container mx-auto max-w-4xl text-center">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-primary/10 rounded-full text-primary">
            <Mail className="w-8 h-8" />
          </div>
        </div>

        <h2 className="text-3xl font-bold mb-4 tracking-tight">{title}</h2>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          {subtitle}
        </p>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            required
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <ThemedButton type="submit" size="lg" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Subscribing...
              </>
            ) : (
              buttonText
            )}
          </ThemedButton>
        </form>
      </div>
    </section>
  );
}
