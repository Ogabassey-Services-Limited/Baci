'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import z from 'zod';
import { Logo } from '@/components/logo';
import { PasswordStrengthIndicator } from '@/components/password-strength-indicator';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import {
  checkPasswordStrength,
  MIN_ACCEPTABLE_PASSWORD_STRENGTH,
} from '@/lib/utils';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .refine(
        (password) =>
          checkPasswordStrength(password) >= MIN_ACCEPTABLE_PASSWORD_STRENGTH,
        {
          message:
            'Password is not strong enough. Add more characters or mix letters, numbers, and symbols.',
        }
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })
  .superRefine(async (data, ctx) => {
    if (data.password && data.password.length >= 8) {
      // Check for common passwords first (instant, no network)
      const { isCommonPassword } = await import('@/lib/utils');
      if (isCommonPassword(data.password)) {
        ctx.addIssue({
          code: 'custom',
          path: ['password'],
          message:
            'This password is too common. Please choose a more unique password.',
        });
        return;
      }

      // Check for breached passwords
      try {
        const { checkPasswordBreach } = await import('@/lib/password-breach');
        const { isBreached } = await checkPasswordBreach(data.password);
        if (isBreached) {
          ctx.addIssue({
            code: 'custom',
            path: ['password'],
            message:
              'This password has been compromised in a data breach. Please choose a different password.',
          });
        }
      } catch (error) {
        console.error('Breach check failed:', error);
      }
    }
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();

  const form = useForm<
    z.input<typeof resetPasswordSchema>,
    unknown,
    ResetPasswordFormValues
  >({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const passwordValue = form.watch('password');
  const passwordStrength = checkPasswordStrength(passwordValue || '');

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          toast({
            variant: 'destructive',
            title: 'Invalid Link',
            description: 'The password reset link is invalid or has expired.',
          });
          router.push('/login');
        }
      });
    }
  }, [searchParams, supabase.auth, router, toast]);

  const onSubmit = async (data: ResetPasswordFormValues) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });
      if (error) throw error;
      toast({
        title: 'Password Updated!',
        description:
          'Your password has been successfully reset. You can now sign in.',
      });
      router.push('/login');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Reset Password',
        description: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] bg-center mask-[linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      {/* Animated Orbs */}
      <div
        className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/30 rounded-full blur-3xl animate-pulse"
        style={{ animationDuration: '4s' }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/30 rounded-full blur-3xl animate-pulse"
        style={{ animationDuration: '6s' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-[420px] p-4"
      >
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl shadow-2xl">
          {/* Glass Shine Effect */}
          <div className="absolute inset-0 bg-linear-to-br from-white/20 via-transparent to-transparent pointer-events-none" />

          <div className="relative p-8">
            <div className="flex flex-col items-center text-center mb-8">
              <Link
                href="/"
                className="mb-6 transition-transform hover:scale-105"
              >
                <Logo />
              </Link>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  Reset Password
                </h1>
                <p className="text-sm text-muted-foreground">
                  Enter and confirm your new password below.
                </p>
              </div>
            </div>

            <FormProvider {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Min. 8 characters"
                            {...field}
                            className="pl-10 pr-10 h-11 bg-white/50 dark:bg-black/20 border-white/10 focus:border-primary/50 transition-all"
                            id="password"
                            name="password"
                            autoComplete="new-password"
                            spellCheck="false"
                            autoCorrect="off"
                            autoCapitalize="off"
                            data-form-type="password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent z-20"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
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
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="Re-enter your new password"
                            {...field}
                            className="pl-10 pr-10 h-11 bg-white/50 dark:bg-black/20 border-white/10 focus:border-primary/50 transition-all"
                            id="confirmPassword"
                            name="confirmPassword"
                            autoComplete="new-password"
                            spellCheck="false"
                            autoCorrect="off"
                            autoCapitalize="off"
                            data-form-type="password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent z-20"
                            onClick={() =>
                              setShowConfirmPassword(!showConfirmPassword)
                            }
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <SubmitButton
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  pendingText="Updating..."
                  disabled={isLoading}
                >
                  Update Password
                </SubmitButton>
              </form>
            </FormProvider>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
