import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type NewsletterComponentProps = {
  title: string;
  description: string;
  buttonText: string;
  placeholder?: string;
};

export function NewsletterComponent({
  title,
  description,
  buttonText,
  placeholder,
}: NewsletterComponentProps) {
  return (
    <section className="py-16 container px-4 md:px-6">
      <div className="bg-primary text-primary-foreground rounded-2xl p-8 md:p-12 text-center max-w-4xl mx-auto">
        <Mail className="size-12 mx-auto mb-6 opacity-80" aria-hidden="true" />
        <h2 className="text-3xl font-bold mb-4">{title}</h2>
        <p className="text-lg mb-8 max-w-2xl mx-auto">{description}</p>
        <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
          <Input
            type="email"
            placeholder={placeholder}
            className="bg-background text-foreground border-0"
            aria-label="Email address for newsletter"
          />
          <Button variant="secondary" size="lg">
            {buttonText}
          </Button>
        </div>
      </div>
    </section>
  );
}
