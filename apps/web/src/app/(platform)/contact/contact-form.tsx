'use client';

import { Loader2, Send } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiPost } from '@/lib/api-client';

const PLATFORM_MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';

// Hoisted out of the component so React Compiler can lower the handler body
// (try/finally + throw-in-try are not yet supported inside component bodies).
async function submitContactForm(data: FormData): Promise<boolean> {
  const firstName = data.get('first-name') as string;
  const lastName = data.get('last-name') as string;

  try {
    await apiPost('/api/forms/submit', {
      merchantId: PLATFORM_MERCHANT_ID,
      formName: 'contact',
      formData: {
        name: `${firstName} ${lastName}`.trim(),
        email: data.get('email') as string,
        message: data.get('message') as string,
      },
    });

    return true;
  } catch {
    return false;
  }
}

export function PlatformContactForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const form = e.currentTarget;
    const data = new FormData(form);

    const succeeded = await submitContactForm(data);

    if (succeeded) {
      toast({
        title: 'Message Sent!',
        description: "We'll get back to you as soon as possible.",
      });
      form.reset();
    } else {
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    }

    setIsSubmitting(false);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first-name">First Name</Label>
            <Input
              id="first-name"
              name="first-name"
              placeholder="John"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-name">Last Name</Label>
            <Input id="last-name" name="last-name" placeholder="Doe" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="john@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            name="message"
            placeholder="How can we help you?"
            rows={5}
            required
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="mr-2 size-4" />
              Send Message
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
