'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface NewsletterSectionProps {
  title?: string;
  description?: string;
  buttonText?: string;
  placeholder?: string;
  backgroundColor?: string;
  textColor?: string;
}

export function NewsletterSection({
  title = 'Join the Community',
  description = 'Subscribe to receive updates, access to exclusive deals, and more.',
  buttonText = 'Subscribe',
  placeholder = 'Enter your email address',
  backgroundColor = '#000000',
  textColor = '#FFFFFF',
}: NewsletterSectionProps) {
  return (
    <section
      className="py-24 relative overflow-hidden"
      style={{
        backgroundColor: backgroundColor,
        color: textColor,
      }}
    >
      {/* Decorative Circles */}
      <div className="absolute top-0 left-0 size-64 bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 size-96 bg-white/5 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 tracking-tight">
            {title}
          </h2>
          <p className="text-lg text-white/70 mb-10 leading-relaxed">
            {description}
          </p>

          <form
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            onSubmit={(e) => e.preventDefault()}
          >
            <Input
              type="email"
              placeholder={placeholder}
              className="bg-white/10 border-white/10 text-white placeholder:text-white/50 h-12"
            />
            <Button
              size="lg"
              className="h-12 px-8 bg-white text-black hover:bg-white/90"
            >
              {buttonText} <ArrowRight className="ml-2 size-4" />
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
