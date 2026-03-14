'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import z from 'zod';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { submitKyc } from '../actions';

// Define the schema for KYC validation
const kycSchema = z
  .object({
    nin: z
      .string()
      .regex(/^\d{11}$/, 'NIN must be exactly 11 digits')
      .optional()
      .or(z.literal('')),
    bvn: z
      .string()
      .regex(/^\d{11}$/, 'BVN must be exactly 11 digits')
      .optional()
      .or(z.literal('')),
    cac_number: z
      .string()
      .regex(
        /^(RC|BN)\s?\d{6,8}$/i,
        'CAC must be in format RC/BN followed by 6-8 digits (e.g. RC 123456)'
      )
      .optional()
      .or(z.literal('')),
  })
  .refine((data) => data.nin || data.bvn || data.cac_number, {
    message: 'Please provide at least one verification document',
    path: ['nin'], // Attach error to NIN field as a general error location
  });

type KycFormValues = z.infer<typeof kycSchema>;

interface KycFormProps {
  initialData: {
    nin: string;
    bvn: string;
    cac_number: string;
    kyc_status: 'pending' | 'verified' | 'rejected' | null;
  };
}

export function KycForm({ initialData }: KycFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const form = useForm<KycFormValues>({
    resolver: zodResolver(kycSchema),
    defaultValues: {
      nin: initialData.nin || '',
      bvn: initialData.bvn || '',
      cac_number: initialData.cac_number || '',
    },
  });

  const onSubmit = async (data: KycFormValues) => {
    setSaving(true);
    try {
      // Use Server Action instead of fetch
      const result = await submitKyc({
        nin: data.nin || null,
        bvn: data.bvn || null,
        cac_number: data.cac_number || null,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save KYC information');
      }

      toast({
        title: 'KYC Information Saved',
        description: 'Your verification details have been submitted.',
      });

      // Redirect back to dashboard with success indicator
      router.push('/dashboard?setup_complete=payments');
      router.refresh(); // Refresh server components
    } catch (error) {
      console.error('Failed to save KYC:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to save KYC information. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const statusConfig = {
    pending: {
      icon: AlertCircle,
      label: 'Pending Review',
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    verified: {
      icon: CheckCircle2,
      label: 'Verified',
      color: 'text-green-600 bg-green-50 border-green-200',
    },
    rejected: {
      icon: AlertCircle,
      label: 'Rejected',
      color: 'text-red-600 bg-red-50 border-red-200',
    },
  };

  const status = initialData.kyc_status
    ? statusConfig[initialData.kyc_status]
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Business Verification (KYC)</CardTitle>
            <CardDescription>
              Verify your identity to enable payment processing
            </CardDescription>
          </div>
        </div>

        {status && (
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border mt-4',
              status.color
            )}
            role="alert"
          >
            <status.icon className="h-4 w-4" />
            <span className="text-sm font-medium">Status: {status.label}</span>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {form.formState.errors.nin?.message ===
          'Please provide at least one verification document' && (
          <div
            className="mb-6 p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2"
            role="alert"
          >
            <AlertCircle className="h-4 w-4" />
            Please provide at least one verification document (NIN, BVN, or CAC)
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="nin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NIN (National Identification Number)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="12345678901"
                        maxLength={11}
                        inputMode="numeric"
                        aria-invalid={!!form.formState.errors.nin}
                        {...field}
                        onChange={(e) => {
                          // Allow only numbers
                          const value = e.target.value.replace(/\D/g, '');
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Your 11-digit National Identification Number
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bvn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>BVN (Bank Verification Number)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="22123456789"
                        maxLength={11}
                        inputMode="numeric"
                        aria-invalid={!!form.formState.errors.bvn}
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Your 11-digit Bank Verification Number
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cac_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CAC Registration Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="RC 123456 or BN 123456"
                        aria-invalid={!!form.formState.errors.cac_number}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Format: RC/BN followed by 6-8 digits
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save KYC Information'
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Your information is encrypted and securely stored. We only use it
              for payment verification purposes.
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
