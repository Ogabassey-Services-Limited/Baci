'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { PasswordStrengthIndicator } from '@/components/password-strength-indicator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { PasswordInput } from '@/components/ui/password-input';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { checkPasswordStrength } from '@/lib/utils';
import type {
  ChangePasswordValues,
  SetPasswordValues,
} from '@/schemas/account-security';
import {
  changePasswordSchema,
  setPasswordSchema,
} from '@/schemas/account-security';

export function SecurityForm() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasPasswordIdentity =
    user?.identities?.some((i) => i.provider === 'email') ?? false;

  const form = useForm<SetPasswordValues | ChangePasswordValues>({
    resolver: zodResolver(
      hasPasswordIdentity ? changePasswordSchema : setPasswordSchema
    ),
    defaultValues: hasPasswordIdentity
      ? { currentPassword: '', newPassword: '', confirmPassword: '' }
      : { newPassword: '', confirmPassword: '' },
  });

  const passwordValue = form.watch('newPassword');
  const passwordStrength = checkPasswordStrength(passwordValue || '');

  const onSubmit = async (data: SetPasswordValues | ChangePasswordValues) => {
    setIsSubmitting(true);

    try {
      const supabase = createClient();

      // For users with existing password, verify current password first
      if (hasPasswordIdentity && 'currentPassword' in data) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user?.email ?? '',
          password: data.currentPassword,
        });

        if (verifyError) {
          form.setError('currentPassword' as keyof typeof data, {
            message: 'Current password is incorrect.',
          });
          return;
        }
      }

      // Check for breached passwords (async, fail-safe)
      try {
        const { checkPasswordBreach } = await import('@/lib/password-breach');
        const { isBreached } = await checkPasswordBreach(data.newPassword);
        if (isBreached) {
          form.setError('newPassword', {
            message:
              'This password has been found in a data breach. Please choose a different password.',
          });
          return;
        }
      } catch {
        // Breach check failed (network issue) — continue, fail-safe
      }

      // Set or update the password
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) {
        throw error;
      }

      toast({
        title: hasPasswordIdentity ? 'Password Changed' : 'Password Set',
        description: hasPasswordIdentity
          ? 'Your password has been updated successfully.'
          : 'You can now sign in with your email and password.',
      });

      form.reset();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Update Password',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <Card className="glass">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5" />
          {hasPasswordIdentity ? 'Change Password' : 'Set Password'}
        </CardTitle>
        <CardDescription>
          {hasPasswordIdentity
            ? 'Update your existing password.'
            : 'You signed in with a social account. Set a password to also sign in with email.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasPasswordIdentity && (
          <Alert className="mb-6">
            <AlertCircle className="size-4" />
            <AlertDescription>
              Your account currently uses{' '}
              {user?.app_metadata?.provider === 'apple' ? 'Apple' : 'Google'}{' '}
              sign-in only. Setting a password lets you also log in with your
              email and password.
            </AlertDescription>
          </Alert>
        )}

        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 max-w-md"
          >
            {hasPasswordIdentity && (
              <FormField
                control={form.control}
                name={
                  'currentPassword' as keyof (
                    | SetPasswordValues
                    | ChangePasswordValues
                  )
                }
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder="Enter your current password"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {hasPasswordIdentity ? 'New Password' : 'Password'}
                  </FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <PasswordStrengthIndicator strength={passwordStrength} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting} className="mt-2">
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {hasPasswordIdentity ? 'Change Password' : 'Set Password'}
            </Button>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
