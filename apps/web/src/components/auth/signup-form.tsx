'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { type SignupState, signupAction } from '@/app/(auth)/signup/actions';
import { Logo } from '@/components/logo';
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
import { SubmitButton } from '@/components/ui/submit-button';
import { useToast } from '@/hooks/use-toast';
import { type SignupValues, signupSchema } from '@/schemas/auth';

const initialState: SignupState = { message: '', success: false };

export default function SignupForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Get email and redirect from URL (e.g., from an invite link)
  const defaultEmail = searchParams.get('email') || '';
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const isStaffInviteSignup =
    searchParams.get('type') === 'staff' || redirectTo.startsWith('/invite/');

  const [state, formAction] = useActionState(signupAction, initialState);

  const form = useForm<z.input<typeof signupSchema>, unknown, SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: defaultEmail,
      password: '',
      confirmPassword: '',
    },
  });

  // Handle server-side errors
  useEffect(() => {
    if (state.message) {
      toast({
        variant: 'destructive',
        title: 'Signup Failed',
        description: state.message,
      });
    }
    if (state.errors?.fieldErrors) {
      Object.entries(state.errors.fieldErrors).forEach(([key, messages]) => {
        form.setError(key as keyof SignupValues, {
          message: messages[0],
        });
      });
    }
  }, [state, form, toast]);

  return (
    <main
      id="main-content"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background"
    >
      {/* Static Background - Matched to Login Page */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      {/* Simplified static orbs */}
      <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-[420px] p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl shadow-2xl">
          {/* Glass Shine Effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none" />

          <div className="relative p-8">
            <div className="flex flex-col items-center text-center mb-8">
              <Link
                href="/"
                className="mb-6 transition-transform hover:scale-105"
              >
                <Logo priority />
              </Link>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  Create your account
                </h1>
                <p className="text-sm text-muted-foreground">
                  Join your team on Baci
                </p>
              </div>
            </div>

            <div className="animate-in fade-in duration-300">
              <Form {...form}>
                <form action={formAction} className="space-y-4">
                  <input type="hidden" name="redirectTo" value={redirectTo} />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <div className="relative group">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="name@example.com"
                              className="pl-10 h-11 bg-white/50 dark:bg-black/20 border-primary/10 focus:border-primary/50 transition-all"
                              autoComplete="email"
                              readOnly={isStaffInviteSignup && !!defaultEmail}
                              autoCapitalize="none"
                            />
                          </FormControl>
                        </div>
                        {isStaffInviteSignup && defaultEmail ? (
                          <p className="text-xs text-muted-foreground">
                            This invite is locked to {defaultEmail}.
                          </p>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <div className="relative group">
                          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <FormControl>
                            <Input
                              {...field}
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Create a password (min 8 chars)"
                              className="pl-10 pr-10 h-11 bg-white/50 dark:bg-black/20 border-primary/10 focus:border-primary/50 transition-all"
                              autoComplete="new-password"
                            />
                          </FormControl>
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
                        <div className="relative group">
                          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <FormControl>
                            <Input
                              {...field}
                              type={showConfirmPassword ? 'text' : 'password'}
                              placeholder="Confirm your password"
                              className="pl-10 pr-10 h-11 bg-white/50 dark:bg-black/20 border-primary/10 focus:border-primary/50 transition-all"
                              autoComplete="new-password"
                            />
                          </FormControl>
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <SubmitButton
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    pendingText="Creating Account..."
                    icon={<ArrowRight className="ml-2 h-4 w-4" />}
                  >
                    Create Account
                  </SubmitButton>
                </form>
              </Form>

              <div className="mt-6 text-center text-sm">
                <span className="text-muted-foreground">
                  Already have an account?{' '}
                </span>
                <Link
                  href="/login"
                  className="font-semibold text-primary hover:underline transition-all"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 animate-in fade-in duration-500 delay-300">
          By continuing, you agree to our{' '}
          <Link
            href="/terms"
            className="underline hover:text-primary transition-colors"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy"
            className="underline hover:text-primary transition-colors"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
