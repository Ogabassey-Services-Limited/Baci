'use client';

import { useState, useActionState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, Mail, Github, ArrowRight, Sparkles, KeyRound, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/logo';
import { loginAction, forgotPasswordAction, type AuthActionState } from '@/app/actions/auth';

const GoogleIcon = () => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
        <title>Google</title>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

const initialState: AuthActionState = { error: null, success: false };

export default function LoginForm() {
    const [mode, setMode] = useState<'login' | 'forgot-password'>('login');
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isGithubLoading, setIsGithubLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { toast } = useToast();
    const supabase = createClient();

    // React 19 useActionState for login form
    const [loginState, loginFormAction] = useActionState(loginAction, initialState);

    // React 19 useActionState for forgot password form
    const [forgotState, forgotFormAction] = useActionState(forgotPasswordAction, initialState);

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
                description: 'Please check your email for a link to reset your password.',
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

    const handleOAuthSignIn = async (provider: 'google' | 'github') => {
        if (provider === 'google') setIsGoogleLoading(true);
        if (provider === 'github') setIsGithubLoading(true);

        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) {
            toast({
                variant: 'destructive',
                title: `${provider === 'google' ? 'Google' : 'GitHub'} Sign-in Failed`,
                description: error.message,
            });
            if (provider === 'google') setIsGoogleLoading(false);
            if (provider === 'github') setIsGithubLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
            {/* Dynamic Background Elements */}
            <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
            <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

            {/* Animated Orbs */}
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative z-10 w-full max-w-[420px] p-4"
            >
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl shadow-2xl">
                    {/* Glass Shine Effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none" />

                    <div className="relative p-8">
                        <div className="flex flex-col items-center text-center mb-8">
                            <Link href="/" className="mb-6 transition-transform hover:scale-105">
                                <Logo />
                            </Link>
                            <motion.div
                                key={mode}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-2"
                            >
                                <h1 className="text-2xl font-bold tracking-tight">
                                    {mode === 'login' ? 'Welcome back' : 'Reset Password'}
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    {mode === 'login'
                                        ? 'Enter your credentials to access your store'
                                        : 'Enter your email to receive a reset link'}
                                </p>
                            </motion.div>
                        </div>

                        <AnimatePresence mode="wait">
                            {mode === 'login' ? (
                                <motion.div
                                    key="login-form"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <form action={loginFormAction} className="space-y-4">
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
                                                    placeholder="••••••••"
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
                                            disabled={isGoogleLoading || isGithubLoading}
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

                                    <div className="grid grid-cols-2 gap-3">
                                        <Button
                                            variant="outline"
                                            className="h-12 bg-white/50 dark:bg-black/20 border-primary/10 hover:bg-white/80 dark:hover:bg-white/10 transition-all hover:scale-[1.02]"
                                            onClick={() => handleOAuthSignIn('google')}
                                            disabled={isGoogleLoading || isGithubLoading}
                                        >
                                            {isGoogleLoading ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <GoogleIcon />
                                            )}
                                            <span className="ml-2">Google</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="h-12 bg-white/50 dark:bg-black/20 border-primary/10 hover:bg-white/80 dark:hover:bg-white/10 transition-all hover:scale-[1.02]"
                                            onClick={() => handleOAuthSignIn('github')}
                                            disabled={isGoogleLoading || isGithubLoading}
                                        >
                                            {isGithubLoading ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Github className="mr-2 h-4 w-4" />
                                            )}
                                            GitHub
                                        </Button>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="forgot-password-form"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                >
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
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-center text-xs text-muted-foreground mt-6"
                >
                    By continuing, you agree to our{' '}
                    <Link href="/terms" className="underline hover:text-primary transition-colors">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="underline hover:text-primary transition-colors">Privacy Policy</Link>
                    .
                </motion.p>
            </motion.div>
        </div>
    );
}
