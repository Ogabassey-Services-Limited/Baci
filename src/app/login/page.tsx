
'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, Mail, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/logo';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

type AuthFormValues = z.infer<typeof authSchema>;
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

const GoogleIcon = () => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
      <title>Google</title>
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.05 1.05-2.36 1.67-4.04 1.67-3.27 0-5.93-2.66-5.93-5.93s2.66-5.93 5.93-5.93c1.73 0 3.23.68 4.17 1.57l2.48-2.48C18.47 2.44 15.82 1 12.48 1 7.23 1 3.06 4.93 3.06 10s4.17 9 9.42 9c2.8 0 4.93-1.07 6.57-2.62 1.73-1.62 2.36-3.88 2.36-6.09 0-.6-.05-1.18-.15-1.73H12.48z" />
    </svg>
  );

export default function LoginPage() {
    const [mode, setMode] = useState<'login' | 'signup' | 'forgot-password'>('login');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const supabase = createClient();
    
    const form = useForm<AuthFormValues>({
        resolver: zodResolver(authSchema),
        defaultValues: { email: '', password: '' },
    });
    
    const forgotPasswordForm = useForm<ForgotPasswordFormValues>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: { email: '' },
    });

    const onSubmit = async (data: AuthFormValues) => {
        setIsLoading(true);
        try {
            if (mode === 'login') {
                const { data: authData, error } = await supabase.auth.signInWithPassword(data);
                if (error) throw error;
                toast({ title: "Sign-in Successful", description: "Welcome back!" });
                router.push('/dashboard');
            } else {
                const { error } = await supabase.auth.signUp(data);
                if (error) throw error;
                toast({ 
                    title: "Account Created!", 
                    description: "Please check your email to verify your account before signing in.",
                    duration: 7000
                });
                setMode('login'); // Switch to login view after successful signup
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: mode === 'login' ? 'Sign-in Failed' : 'Sign-up Failed',
                description: (error as Error).message,
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleForgotPassword = async (data: ForgotPasswordFormValues) => {
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
            toast({
                title: 'Password Reset Email Sent',
                description: 'Please check your email for a link to reset your password.',
            });
            setMode('login');
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error Sending Reset Email',
                description: (error as Error).message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) {
          toast({
            variant: 'destructive',
            title: 'Google Sign-in Failed',
            description: error.message,
          });
          setIsGoogleLoading(false);
        }
    };

    const getTitle = () => {
        if (mode === 'login') return 'Welcome Back!';
        if (mode === 'signup') return 'Create an Account';
        return 'Forgot Password';
    }

    const getDescription = () => {
        if (mode === 'login') return 'Enter your credentials to access your dashboard.';
        if (mode === 'signup') return 'Sign up to start building your store.';
        return 'Enter your email to receive a password reset link.';
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
            <div className="w-full max-w-sm">
                <Card>
                    <CardHeader className="text-center p-4">
                        <div className="flex justify-center">
                            <Link href="/">
                                <Logo />
                            </Link>
                        </div>
                        <CardTitle className="pt-2">{getTitle()}</CardTitle>
                        <CardDescription>
                           {getDescription()}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {mode === 'forgot-password' ? (
                             <FormProvider {...forgotPasswordForm}>
                                <form onSubmit={forgotPasswordForm.handleSubmit(handleForgotPassword)} className="space-y-4">
                                     <FormField
                                        control={forgotPasswordForm.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input type="email" placeholder="you@example.com" {...field} className="pl-10" id="email-forgot" name="email-forgot" autoComplete="email" />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" className="w-full" disabled={isLoading}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Send Reset Link
                                    </Button>
                                </form>
                            </FormProvider>
                        ) : (
                            <FormProvider {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input type="email" placeholder="you@example.com" {...field} className="pl-10" id="email" name="email" autoComplete="email" />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <div className="flex justify-between">
                                                    <FormLabel>Password</FormLabel>
                                                    {mode === 'login' && (
                                                        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setMode('forgot-password')}>
                                                            Forgot Password?
                                                        </Button>
                                                    )}
                                                </div>
                                                <FormControl>
                                                    <div className="relative">
                                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input type={showPassword ? 'text' : 'password'} {...field} className="pl-10 pr-10" id="password" name="password" autoComplete={mode === 'login' ? "current-password" : "new-password"} />
                                                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                            <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
                                                        </Button>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" className="w-full" disabled={isLoading}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {mode === 'login' ? 'Sign In' : 'Sign Up'}
                                    </Button>
                                </form>
                            </FormProvider>
                        )}
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                            </div>
                        </div>

                        <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isGoogleLoading}>
                            {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
                            Google
                        </Button>

                        <p className="text-sm text-center text-muted-foreground mt-6">
                            {mode === 'login' && "Don't have an account?"}
                            {mode === 'signup' && "Already have an account?"}
                            {mode === 'forgot-password' && "Remembered your password?"}
                            <Button type="button" variant="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="px-1">
                                {mode === 'login' ? 'Sign Up' : 'Sign In'}
                            </Button>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
