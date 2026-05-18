'use client';

import { Mail } from 'lucide-react';
import { useState } from 'react';
// import { cn } from '@/lib/utils';
import { ThemedButton } from '@/components/themed';

export interface NewsletterProps {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  placeholder?: string;
  backgroundColor?: string;
  textColor?: string;
}

export function Newsletter({
  title = 'Subscribe to our newsletter',
  subtitle = 'Get the latest updates on new products and upcoming sales.',
  buttonText = 'Subscribe',
  placeholder = 'Enter your email address',
  backgroundColor = '#f9fafb',
  textColor = '#111827',
}: NewsletterProps) {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Handle newsletter subscription logic here
    setEmail('');
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
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <ThemedButton type="submit" size="lg">
            {buttonText}
          </ThemedButton>
        </form>
      </div>
    </section>
  );
}
