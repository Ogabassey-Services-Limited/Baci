'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { User } from '@supabase/supabase-js';
import {
    AlertCircle,
    CheckCircle,
    Eye,
    EyeOff,
    KeyRound,
    Loader2,
    Mail,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordStrengthIndicator } from '@/components/password-strength-indicator';
import { useToast } from '@/hooks/use-toast';
import { checkPasswordStrength } from '@/lib/utils';
import { sendMagicLink } from '@/app/onboarding/actions';
import { OnboardingFormValues } from '@/schemas/onboarding';

interface Step3Props {
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onMagicLinkSent: () => void;
    user: User | null;
}

export default function Step3_Account({
    onKeyDown,
    onMagicLinkSent,
    user,
}: Step3Props) {
    const form = useFormContext<OnboardingFormValues>();
    const { control, watch } = form;
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [magicLinkSubmitting, setMagicLinkSubmitting] =
        useState<boolean>(false);
    const { toast } = useToast();

    const password = watch('password') || '';
    const passwordStrength = checkPasswordStrength(password);
    const isPasswordStrong = passwordStrength >= 3;

    const handleMagicLinkRequest = async () => {
        const { email } = form.getValues();
        const isEmailValid = await form.trigger('email');
        if (!isEmailValid) {
            toast({ title: 'Invalid email', variant: 'destructive' });
            return;
        }

        setMagicLinkSubmitting(true);
        const result = await sendMagicLink(email);
        setMagicLinkSubmitting(false);

        if (result.success) {
            onMagicLinkSent();
        } else {
            toast({
                title: 'Failed to send magic link',
                description: result.message,
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="space-y-4">
            {user ? (
                <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Logged In</AlertTitle>
                    <AlertDescription>
                        You are logged in as <strong>{user.email}</strong>. Click "Create My
                        Store" below to continue.
                    </AlertDescription>
                </Alert>
            ) : (
                <>
                    <FormField
                        control={control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email Address</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="email"
                                            placeholder="you@example.com"
                                            {...field}
                                            value={field.value || ''}
                                            onKeyDown={onKeyDown}
                                            className="pl-10"
                                            name="email"
                                            autoComplete="email"
                                            spellCheck="false"
                                            autoCorrect="off"
                                            autoCapitalize="off"
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex items-center gap-4 my-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground">OR</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleMagicLinkRequest}
                        disabled={magicLinkSubmitting}
                    >
                        {magicLinkSubmitting && (
                            <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                        )}
                        {magicLinkSubmitting
                            ? 'Sending Magic Link...'
                            : 'Continue with Magic Link'}
                    </Button>

                    <div className="flex items-center gap-4 my-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground">
                            OR CREATE PASSWORD
                        </span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    <FormField
                        control={control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Create a strong password"
                                            {...field}
                                            value={field.value || ''}
                                            onKeyDown={onKeyDown}
                                            className="pl-10 pr-10"
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
                                            size="icon"
                                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                            onClick={() => setShowPassword(!showPassword)}
                                            aria-label={
                                                showPassword ? 'Hide password' : 'Show password'
                                            }
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </FormControl>
                                <PasswordStrengthIndicator strength={passwordStrength} />
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {isPasswordStrong && (
                        <FormField
                            control={control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem className="animate-fade-in">
                                    <FormLabel>Confirm Password</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                placeholder="Re-enter your password"
                                                {...field}
                                                value={field.value || ''}
                                                onKeyDown={onKeyDown}
                                                className="pl-10 pr-10"
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
                                                size="icon"
                                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                                onClick={() =>
                                                    setShowConfirmPassword(!showConfirmPassword)
                                                }
                                                aria-label={
                                                    showConfirmPassword
                                                        ? 'Hide password'
                                                        : 'Show password'
                                                }
                                            >
                                                {showConfirmPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                </>
            )}
        </div>
    );
}
