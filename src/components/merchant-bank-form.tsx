'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiPost } from '@/lib/api-client';
import type { Bank } from '@/lib/paystack';

const bankSchema = z.object({
  bankCode: z.string().min(1, 'Please select a bank'),
  accountNumber: z.string().length(10, 'Account number must be 10 digits'),
  businessName: z.string().min(2, 'Business name is required'),
});

type BankFormValues = z.infer<typeof bankSchema>;

interface MerchantBankFormProps {
  initialData?: {
    bankCode?: string;
    accountNumber?: string;
    businessName?: string;
    accountName?: string;
  };
  onSuccess?: () => void;
}

export function MerchantBankForm({
  initialData,
  onSuccess,
}: MerchantBankFormProps) {
  const { toast } = useToast();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(
    initialData?.accountName || null
  );

  const form = useForm<BankFormValues>({
    resolver: zodResolver(bankSchema),
    defaultValues: {
      bankCode: initialData?.bankCode || '',
      accountNumber: initialData?.accountNumber || '',
      businessName: initialData?.businessName || '',
    },
  });

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const response = await fetch('/api/paystack/banks');
        const data = await response.json();
        if (data.banks) {
          setBanks(data.banks);
        }
      } catch (error) {
        console.error('Failed to fetch banks:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load bank list. Please refresh.',
        });
      } finally {
        setIsLoadingBanks(false);
      }
    };

    fetchBanks();
  }, [toast]);

  const onSubmit = async (data: BankFormValues) => {
    setIsSubmitting(true);
    setVerifiedName(null); // Reset verification while submitting

    try {
      const result = await apiPost<{
        success: boolean;
        accountName: string;
        subaccountCode: string;
      }>('/api/paystack/subaccount', data);

      if (result.success) {
        setVerifiedName(result.accountName);
        toast({
          title: 'Bank Details Saved',
          description: `Verified: ${result.accountName}`,
        });
        onSuccess?.();
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description:
          error instanceof Error
            ? error.message
            : 'Could not verify and save bank details.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="businessName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Name on Account</FormLabel>
              <FormControl>
                <Input placeholder="My Business Name" {...field} />
              </FormControl>
              <FormDescription>
                This name will appear on customer bank statements.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bankCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bank</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={isLoadingBanks}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        isLoadingBanks ? 'Loading banks...' : 'Select your bank'
                      }
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.code}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="accountNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account Number</FormLabel>
              <FormControl>
                <Input
                  placeholder="0123456789"
                  maxLength={10}
                  inputMode="numeric"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {verifiedName && (
          <div className="rounded-md bg-green-50 p-4 flex items-center gap-3 text-green-700 border border-green-200">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <p className="font-medium">Account Verified</p>
              <p className="text-sm">{verifiedName}</p>
            </div>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Verifying & Saving...' : 'Save Bank Details'}
        </Button>
      </form>
    </Form>
  );
}
