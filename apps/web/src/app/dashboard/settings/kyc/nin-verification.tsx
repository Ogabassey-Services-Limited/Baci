'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';

const ninFormSchema = z.object({
  nin: z.string().regex(/^\d{11}$/, 'NIN must be exactly 11 digits'),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth is required')
    .refine((val) => {
      const [year, month, day] = val.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
      ) {
        return false;
      }
      const now = new Date();
      const todayUtc = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
      );
      return date.getTime() < todayUtc;
    }, 'Date of birth must be a valid past date'),
});

type NinFormValues = z.input<typeof ninFormSchema>;

interface NinVerificationProps {
  verified: boolean;
  prefillNin: string | null;
  prefillFirstName: string | null;
  prefillLastName: string | null;
  prefillDateOfBirth: string | null;
  onVerified: () => void;
}

export function NinVerification({
  verified,
  prefillNin,
  prefillFirstName,
  prefillLastName,
  prefillDateOfBirth,
  onVerified,
}: NinVerificationProps) {
  const { toast } = useToast();
  // Use local date (not UTC) so the DOB max matches the user's current day.
  const todayIso = new Date().toLocaleDateString('en-CA');

  const form = useForm<NinFormValues>({
    resolver: zodResolver(ninFormSchema),
    defaultValues: {
      nin: prefillNin ?? '',
      firstName: prefillFirstName ?? '',
      lastName: prefillLastName ?? '',
      dateOfBirth: prefillDateOfBirth ?? '',
    },
  });

  if (verified) {
    return (
      <Alert className="border-green-200 bg-green-50 text-green-800">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle>Verified</AlertTitle>
        <AlertDescription>Your NIN has been verified.</AlertDescription>
      </Alert>
    );
  }

  const onSubmit = async (values: NinFormValues) => {
    try {
      const res = await fetchWithCsrf('/api/merchant/verify-nin', {
        method: 'POST',
        body: JSON.stringify(values),
      });

      if (res.status === 429) {
        toast({
          variant: 'destructive',
          title: 'Rate limit exceeded',
          description: 'Please wait a moment and try again.',
        });
        return;
      }

      const data = await res.json().catch(() => ({ error: 'Request failed' }));

      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data.error ?? 'Something went wrong.',
        });
        return;
      }

      if (data.verified) {
        toast({ title: 'Success', description: 'NIN verified successfully.' });
        onVerified();
      } else {
        toast({
          variant: 'destructive',
          title: 'Verification failed',
          description:
            "The details don't match NIN records. Please check and try again.",
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Network error. Please try again.',
      });
    }
  };

  return (
    <div className="space-y-6 p-1">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="nin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>NIN</FormLabel>
                <FormControl>
                  <Input
                    placeholder="12345678901"
                    maxLength={11}
                    inputMode="numeric"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e.target.value.replace(/\D/g, ''));
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="First name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Last name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dateOfBirth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Birth</FormLabel>
                <FormControl>
                  <Input type="date" max={todayIso} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Verifying...
              </>
            ) : (
              'Verify NIN'
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
