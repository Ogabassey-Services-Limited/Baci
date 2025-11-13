
'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, Mail } from 'lucide-react';
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

export default function LoginPage() {
    const [mode, setMode] = useState<'login' | 'signup' | 'forgot-password'>('login');
    const [isLoading, setIsLoading] = useState(false);
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
            <div className="w-full max-w-sm space-y-4">
                <div className="flex justify-center">
                    <Link href="/">
                        <Logo />
                    </Link>
                </div>
                <Card>
                    <CardHeader className="text-center">
                        <CardTitle>{getTitle()}</CardTitle>
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
                                                        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setMode('forgot-password')}>
                                                            Forgot Password?
                                                        </Button>
                                                    )}
                                                </div>
                                                <FormControl>
                                                    <div className="relative">
                                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input type="password" {...field} className="pl-10" id="password" name="password" autoComplete={mode === 'login' ? "current-password" : "new-password"} />
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
                        <p className="text-sm text-center text-muted-foreground mt-6">
                            {mode === 'login' && "Don't have an account?"}
                            {mode === 'signup' && "Already have an account?"}
                            {mode === 'forgot-password' && "Remembered your password?"}
                            <Button variant="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="px-1">
                                {mode === 'login' ? 'Sign Up' : 'Sign In'}
                            </Button>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
