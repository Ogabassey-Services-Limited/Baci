'use client';

import type { User } from '@supabase/supabase-js';
import {
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { sendMagicLink } from '@/app/onboarding/actions';
import { PasswordStrengthIndicator } from '@/components/password-strength-indicator';
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
import { useToast } from '@/hooks/use-toast';
import {
  checkPasswordStrength,
  MIN_ACCEPTABLE_PASSWORD_STRENGTH,
} from '@/lib/utils';
import type { OnboardingFormValues } from '@/schemas/onboarding';

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
  const { control, trigger } = form;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [magicLinkSubmitting, setMagicLinkSubmitting] =
    useState<boolean>(false);
  const { toast } = useToast();

  // Use useWatch for reliable reactivity
  const password = useWatch({ control, name: 'password' }) || '';
  const confirmPassword = useWatch({ control, name: 'confirmPassword' }) || '';
  const passwordStrength = checkPasswordStrength(password);
  // Keep the client-side gate aligned with onboardingSchema/account-security validation.
  const hasAcceptablePasswordStrength =
    passwordStrength >= MIN_ACCEPTABLE_PASSWORD_STRENGTH;

  // Re-validate confirmPassword when password changes (proper cross-field validation)
  // biome-ignore lint/correctness/useExhaustiveDependencies: password triggers re-validation of confirmPassword match
  useEffect(() => {
    if (confirmPassword) {
      // Debounce to avoid excessive validation calls
      const timeoutId = setTimeout(() => {
        trigger('confirmPassword');
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [password, confirmPassword, trigger]);

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
          <AlertDescription className="space-y-3">
            <p>
              You are logged in as <strong>{user.email}</strong>. Click "Finish
              Setup" below to save your store.
            </p>
            <Button
              variant="link"
              className="p-0 h-auto text-muted-foreground hover:text-primary underline font-normal"
              onClick={async () => {
                const { createClient } = await import('@/lib/supabase/client');
                const supabase = createClient();
                await supabase.auth.signOut();
                window.location.reload();
              }}
            >
              Not you? Log out
            </Button>
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
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10 text-muted-foreground hover:text-foreground"
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

          {hasAcceptablePasswordStrength && (
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
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10 text-muted-foreground hover:text-foreground"
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
