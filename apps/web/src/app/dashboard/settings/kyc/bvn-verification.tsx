'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
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

const bvnFormSchema = z.object({
  bvn: z.string().regex(/^\d{11}$/, 'BVN must be exactly 11 digits'),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth is required')
    .refine((val) => {
      const [year, month, day] = val.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    }, 'Invalid date'),
  mobileNo: z
    .string()
    .regex(/^0\d{10}$/, 'Enter a valid 11-digit phone number starting with 0'),
});

type BvnFormValues = z.input<typeof bvnFormSchema>;

interface BvnVerificationProps {
  verified: boolean;
  prefillBvn: string | null;
  prefillFirstName: string | null;
  prefillLastName: string | null;
  prefillDateOfBirth: string | null;
  prefillPhone: string | null;
  onVerified: () => void;
}

export function BvnVerification({
  verified,
  prefillBvn,
  prefillFirstName,
  prefillLastName,
  prefillDateOfBirth,
  prefillPhone,
  onVerified,
}: BvnVerificationProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<BvnFormValues>({
    resolver: zodResolver(bvnFormSchema),
    defaultValues: {
      bvn: prefillBvn ?? '',
      firstName: prefillFirstName ?? '',
      lastName: prefillLastName ?? '',
      dateOfBirth: prefillDateOfBirth ?? '',
      mobileNo: prefillPhone ?? '',
    },
  });

  if (verified) {
    return (
      <Alert className="border-green-200 bg-green-50 text-green-800">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle>Verified</AlertTitle>
        <AlertDescription>Your BVN has been verified.</AlertDescription>
      </Alert>
    );
  }

  const onSubmit = async (values: BvnFormValues) => {
    setSubmitting(true);
    try {
      const res = await fetchWithCsrf('/api/merchant/verify-bvn', {
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
        toast({ title: 'Success', description: 'BVN verified successfully.' });
        onVerified();
      } else {
        toast({
          variant: 'destructive',
          title: 'Verification failed',
          description:
            "The details don't match BVN records. Please check and try again.",
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Network error. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-1">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="bvn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>BVN</FormLabel>
                <FormControl>
                  <Input
                    placeholder="22123456789"
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
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mobileNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mobile Number</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="08012345678"
                    maxLength={11}
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

          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Verifying...
              </>
            ) : (
              'Verify BVN'
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
