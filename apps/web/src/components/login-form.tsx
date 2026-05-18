'use client';

import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import {
  type AuthActionState,
  forgotPasswordAction,
  loginAction,
} from '@/app/actions/auth';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { useToast } from '@/hooks/use-toast';
import { sanitizeRelativeRedirectPath } from '@/lib/auth-redirect';
import { createClient } from '@/lib/supabase/client';

const GoogleIcon = () => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
  >
    <title>Google</title>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const AppleIcon = () => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 fill-current"
  >
    <title>Apple</title>
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.671-1.48 3.671-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.609 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
  </svg>
);

const initialState: AuthActionState = { error: null, success: false };

type LoginFormProps = {
  defaultEmail: string;
  redirectTo: string;
};

export default function LoginForm({
  defaultEmail,
  redirectTo,
}: LoginFormProps) {
  const safeRedirectTo = sanitizeRelativeRedirectPath(redirectTo, '/dashboard');
  const [mode, setMode] = useState<'login' | 'forgot-password'>('login');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  // React 19 useActionState for login form
  const [loginState, loginFormAction] = useActionState(
    loginAction,
    initialState
  );

  // React 19 useActionState for forgot password form
  const [forgotState, forgotFormAction] = useActionState(
    forgotPasswordAction,
    initialState
  );

  // Show toast on login error
  useEffect(() => {
    if (loginState.error) {
      toast({
        variant: 'destructive',
        title: 'Sign-in Failed',
        description: loginState.error,
      });
    }
  }, [loginState.error, toast]);

  // Show toast on forgot password result
  useEffect(() => {
    if (forgotState.success) {
      toast({
        title: 'Password Reset Email Sent',
        description:
          'Please check your email for a link to reset your password.',
      });
      setMode('login');
    } else if (forgotState.error) {
      toast({
        variant: 'destructive',
        title: 'Error Sending Reset Email',
        description: forgotState.error,
      });
    }
  }, [forgotState.success, forgotState.error, toast]);

  const handleOAuthSignIn = async ({
    provider,
    label,
    setLoading,
  }: {
    provider: 'google' | 'apple';
    label: string;
    setLoading: (v: boolean) => void;
  }) => {
    setLoading(true);
    const failureTitle = `${label} Sign-in Failed`;
    const fallbackMessage = `Unable to start ${label} sign-in`;

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeRedirectTo)}`,
        },
      });

      if (!error) {
        return;
      }

      toast({
        variant: 'destructive',
        title: failureTitle,
        description: error.message,
      });
      setLoading(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: failureTitle,
        description: error instanceof Error ? error.message : fallbackMessage,
      });
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () =>
    handleOAuthSignIn({
      provider: 'google',
      label: 'Google',
      setLoading: setIsGoogleLoading,
    });

  const handleAppleSignIn = () =>
    handleOAuthSignIn({
      provider: 'apple',
      label: 'Apple',
      setLoading: setIsAppleLoading,
    });

  return (
    <main
      id="main-content"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background"
    >
      {/* Static Background - removed animated orbs for performance */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] bg-center mask-[linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      {/* Simplified static orbs (no animation) */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />

      {/* CSS transition instead of framer-motion */}
      <div className="relative z-10 w-full max-w-[420px] p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl shadow-2xl">
          {/* Glass Shine Effect */}
          <div className="absolute inset-0 bg-linear-to-br from-white/20 via-transparent to-transparent pointer-events-none" />

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
                  {mode === 'login' ? 'Welcome back' : 'Reset Password'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {mode === 'login'
                    ? 'Enter your credentials to access your store'
                    : 'Enter your email to receive a reset link'}
                </p>
              </div>
            </div>

            {mode === 'login' ? (
              <div className="animate-in fade-in duration-300">
                <form action={loginFormAction} className="space-y-4">
                  <input
                    type="hidden"
                    name="redirectTo"
                    value={safeRedirectTo}
                  />
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="name@example.com"
                        required
                        defaultValue={defaultEmail}
                        className="pl-10 h-11 bg-white/50 dark:bg-black/20 border-primary/10 focus:border-primary/50 transition-all"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="password">Password</Label>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                        onClick={() => setMode('forgot-password')}
                      >
                        Forgot password?
                      </Button>
                    </div>
                    <div className="relative group">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        required
                        minLength={8}
                        className="pl-10 pr-10 h-11 bg-white/50 dark:bg-black/20 border-primary/10 focus:border-primary/50 transition-all"
                        autoComplete="current-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent z-20"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <SubmitButton
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    pendingText="Signing in..."
                    icon={<ArrowRight className="ml-2 h-4 w-4" />}
                    disabled={isGoogleLoading}
                  >
                    Sign In
                  </SubmitButton>
                </form>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-transparent px-2 text-muted-foreground backdrop-blur-xl">
                      Or continue with
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="h-12 bg-white/50 dark:bg-black/20 border-primary/10 hover:bg-white/80 dark:hover:bg-white/10 transition-all hover:scale-[1.02]"
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleLoading || isAppleLoading}
                  >
                    {isGoogleLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <GoogleIcon />
                    )}
                    <span className="ml-2">Google</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-12 bg-white/50 dark:bg-black/20 border-primary/10 hover:bg-white/80 dark:hover:bg-white/10 transition-all hover:scale-[1.02]"
                    onClick={handleAppleSignIn}
                    disabled={isGoogleLoading || isAppleLoading}
                  >
                    {isAppleLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <AppleIcon />
                    )}
                    <span className="ml-2">Apple</span>
                  </Button>
                </div>

                <div className="mt-6 text-center text-sm">
                  <span className="text-muted-foreground">
                    Don&apos;t have an account?{' '}
                  </span>
                  <Link
                    href="/onboarding"
                    className="font-semibold text-primary hover:underline transition-all"
                  >
                    Sign Up
                  </Link>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in duration-300">
                <form action={forgotFormAction} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="forgot-email"
                        name="email"
                        type="email"
                        placeholder="name@example.com"
                        required
                        className="pl-10 h-11 bg-white/50 dark:bg-black/20 border-primary/10 focus:border-primary/50 transition-all"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <SubmitButton
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-[1.02]"
                    pendingText="Sending..."
                    icon={<Sparkles className="ml-2 h-4 w-4" />}
                  >
                    Send Reset Link
                  </SubmitButton>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full h-11 hover:bg-white/10"
                    onClick={() => setMode('login')}
                  >
                    Back to Sign In
                  </Button>
                </form>
              </div>
            )}
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
