'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import z from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

// Domain validation schema
const domainSchema = z.object({
  domain: z
    .string()
    .min(1, 'Domain is required')
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i,
      'Invalid domain format (e.g., example.com)'
    )
    .transform((val) => val.trim().toLowerCase()),
});

type DomainFormValues = z.infer<typeof domainSchema>;

export function ConnectDomainForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [verificationInfo, setVerificationInfo] = useState<{
    domain: string;
    token: string;
  } | null>(null);

  const form = useForm<DomainFormValues>({
    resolver: zodResolver(domainSchema),
    defaultValues: { domain: '' },
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: 'Verification token copied to clipboard.',
      });
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast({
        title: 'Failed to copy',
        description: 'Please copy the token manually.',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (data: DomainFormValues) => {
    setVerificationInfo(null);

    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: data.domain,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Domain Added! 🎉',
          description:
            'Your custom domain has been added. Please verify ownership.',
        });

        setVerificationInfo({
          domain: result.domain.domain,
          token: result.verification.value,
        });

        form.reset();
        router.refresh();
      } else {
        toast({
          title: 'Failed to Add Domain',
          description:
            result.error || 'Could not add domain. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error adding domain:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while adding the domain.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Existing Domain</CardTitle>
        <CardDescription>
          Enter the domain name you own (e.g., example.com) to connect it to
          your store.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      placeholder="example.com"
                      {...field}
                      disabled={form.formState.isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Connect
                </>
              )}
            </Button>
          </form>
        </Form>

        {verificationInfo && (
          <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <AlertTitle className="mb-2">Verification Required</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                To verify ownership of{' '}
                <strong>{verificationInfo.domain}</strong>, please add the
                following TXT record to your DNS settings:
              </p>
              <div className="grid gap-2 p-3 bg-white dark:bg-black/40 rounded border text-sm">
                <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                  <span className="font-semibold text-muted-foreground">
                    Type:
                  </span>
                  <span className="font-mono">TXT</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                  <span className="font-semibold text-muted-foreground">
                    Host:
                  </span>
                  <span className="font-mono">@</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                  <span className="font-semibold text-muted-foreground">
                    Value:
                  </span>
                  <div className="flex items-center gap-2">
                    <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded break-all">
                      {verificationInfo.token}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(verificationInfo.token)}
                    >
                      <Copy className="w-3 h-3" />
                      <span className="sr-only">Copy token</span>
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Note: DNS changes can take up to 24 hours to propagate.
              </p>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
