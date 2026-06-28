'use client';

import { ArrowRight, Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import type { LoginFormAction } from './login-form-types';

type LoginPasswordEntryProps = {
  action: LoginFormAction;
  defaultEmail: string;
  disabled: boolean;
  onForgotPassword: () => void;
  onPasswordlessRequest: () => void;
  onTogglePassword: () => void;
  redirectTo: string;
  showPassword: boolean;
};

export function LoginPasswordEntry({
  action,
  defaultEmail,
  disabled,
  onForgotPassword,
  onPasswordlessRequest,
  onTogglePassword,
  redirectTo,
  showPassword,
}: LoginPasswordEntryProps) {
  return (
    <div className="animate-in fade-in duration-300">
      <form action={action} className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative group">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
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
              onClick={onForgotPassword}
            >
              Forgot password?
            </Button>
          </div>
          <div className="relative group">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
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
              onClick={onTogglePassword}
              aria-label="Show password"
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOff className="size-4 text-muted-foreground" />
              ) : (
                <Eye className="size-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
        <SubmitButton
          className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          pendingText="Signing in..."
          icon={<ArrowRight className="ml-2 size-4" />}
          disabled={disabled}
        >
          Sign In
        </SubmitButton>
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 bg-white/50 dark:bg-black/20 border-primary/10 hover:bg-white/80 dark:hover:bg-white/10"
          onClick={onPasswordlessRequest}
          disabled={disabled}
        >
          <Mail className="mr-2 size-4" />
          Email me a code
        </Button>
      </form>
    </div>
  );
}
