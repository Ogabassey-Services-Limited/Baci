'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import z from 'zod';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';

const verifySchema = z.object({
  code: z.string().min(6, {
    message: 'Your verification code must be 6 characters.',
  }),
});

export default function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const { toast } = useToast();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);

  const form = useForm<z.infer<typeof verifySchema>>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      code: '',
    },
  });

  useEffect(() => {
    if (!email) {
      router.push('/login');
    }
  }, [email, router]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  async function onSubmit(data: z.infer<typeof verifySchema>) {
    if (!email) return;
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: data.code,
        type: 'signup',
      });

      if (error) {
        // Fallback to 'email' type (magic link / recovery flow sometimes overlaps)
        // But for strict signup verification, 'signup' or 'email' should be tried.
        console.warn(
          'Signup verification failed, trying recovery type...',
          error.message
        );
        const { error: retryError } = await supabase.auth.verifyOtp({
          email,
          token: data.code,
          type: 'email',
        });

        if (retryError) {
          throw retryError;
        }
      }

      toast({
        title: 'Success',
        description: 'Your email has been verified.',
      });

      // Force refresh to update auth state
      router.refresh();
      router.replace('/dashboard');
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Verification Failed',
        description:
          error instanceof Error
            ? error.message
            : 'Invalid code. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function onResend() {
    if (resendTimer > 0 || !email) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        email,
        type: 'signup',
      });

      if (error) throw error;

      toast({
        title: 'Code Sent',
        description: 'A new verification code has been sent to your email.',
      });
      setResendTimer(60);
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (!email) return null;

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Background Effects (Matching Signup) */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-[420px] p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl shadow-2xl">
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
                  Check your email
                </h1>
                <p className="text-sm text-muted-foreground">
                  We sent a verification code to <br />
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem className="flex flex-col items-center space-y-4">
                      <FormControl>
                        <InputOTP maxLength={6} {...field}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                          </InputOTPGroup>
                          <InputOTPSeparator />
                          <InputOTPGroup>
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-11 bg-primary hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  Verify Email
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center text-sm">
              <button
                type="button"
                onClick={onResend}
                disabled={resendTimer > 0 || isLoading}
                className="text-primary hover:underline disabled:opacity-50 disabled:no-underline font-medium transition-colors"
              >
                {resendTimer > 0
                  ? `Resend code in ${resendTimer}s`
                  : 'Click to resend'}
              </button>
            </div>

            <div className="mt-4 text-center text-sm">
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
