'use client';

import { Mail } from 'lucide-react';
import { useState } from 'react';
import { ThemedButton } from '@/components/themed';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { fetchWithCsrf } from '@/lib/api-client';

export interface NewsletterProps {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  placeholder?: string;
  backgroundColor?: string;
  textColor?: string;
  source?: 'widget' | 'footer' | 'checkout' | 'popup';
}

interface NewsletterSubscriptionPayload {
  email: string;
  merchantId: string | undefined;
  source: NonNullable<NewsletterProps['source']>;
}

// Module-scope helper: throw-inside-try/catch in the component body blocks
// React Compiler memoization of the Newsletter component.
async function submitNewsletterSubscription(
  payload: NewsletterSubscriptionPayload
): Promise<boolean> {
  try {
    const response = await fetchWithCsrf('/api/newsletter/subscribe', {
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function Newsletter({
  title = 'Subscribe to our newsletter',
  subtitle = 'Get the latest updates on new products and upcoming sales.',
  buttonText = 'Subscribe',
  placeholder = 'Enter your email address',
  backgroundColor = '#f9fafb',
  textColor = '#111827',
  source = 'footer',
}: NewsletterProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>(
    'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setError(null);

    const subscribed = await submitNewsletterSubscription({
      email,
      merchantId: merchant?.id,
      source,
    });

    if (subscribed) {
      setEmail('');
      setStatus('success');
      return;
    }

    setError('Could not subscribe right now. Please try again.');
    setStatus('idle');
  };

  const isSubmitting = status === 'submitting';

  return (
    <section
      className="py-16 px-4"
      style={{ backgroundColor, color: textColor }}
    >
      <div className="container mx-auto max-w-4xl text-center">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-primary/10 rounded-full text-primary">
            <Mail className="size-8" />
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
            aria-label="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            aria-label="Email address"
            required
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <ThemedButton type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? 'Subscribing…' : buttonText}
          </ThemedButton>
        </form>
        {status === 'success' ? (
          <p className="mt-4 text-sm" role="status">
            You are subscribed. Check your email for updates.
          </p>
        ) : null}
        {error ? (
          <p
            aria-label="Newsletter subscription failed"
            className="mt-4 text-sm"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
