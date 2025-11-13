
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

type AuthFormValues = z.infer<typeof authSchema>;

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const supabase = createClient();
    
    const form = useForm<AuthFormValues>({
        resolver: zodResolver(authSchema),
        defaultValues: { email: '', password: '' },
    });

    const onSubmit = async (data: AuthFormValues) => {
        setIsLoading(true);
        try {
            if (isLogin) {
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
                setIsLogin(true); // Switch to login view after successful signup
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: isLogin ? 'Sign-in Failed' : 'Sign-up Failed',
                description: (error as Error).message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
            <div className="w-full max-w-sm space-y-4">
                <div className="text-center">
                    <Link href="/">
                        <Logo className="mx-auto" />
                    </Link>
                </div>
                <Card>
                    <CardHeader className="text-center">
                        <CardTitle>{isLogin ? 'Welcome Back!' : 'Create an Account'}</CardTitle>
                        <CardDescription>
                            {isLogin ? 'Enter your credentials to access your dashboard.' : 'Sign up to start building your store.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
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
                                            <FormLabel>Password</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input type="password" {...field} className="pl-10" id="password" name="password" autoComplete={isLogin ? "current-password" : "new-password"} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isLogin ? 'Sign In' : 'Sign Up'}
                                </Button>
                            </form>
                        </FormProvider>
                        <p className="text-sm text-center text-muted-foreground mt-6">
                            {isLogin ? "Don't have an account?" : 'Already have an account?'}
                            <Button variant="link" onClick={() => setIsLogin(!isLogin)} className="px-1">
                                {isLogin ? 'Sign Up' : 'Sign In'}
                            </Button>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
