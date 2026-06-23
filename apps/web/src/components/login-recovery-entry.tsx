'use client';

import { Mail, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import type { LoginFormAction } from './login-form-types';

type LoginRecoveryEntryProps = {
  action: LoginFormAction;
  onBackToLogin: () => void;
};

export function LoginRecoveryEntry({
  action,
  onBackToLogin,
}: LoginRecoveryEntryProps) {
  return (
    <div className="animate-in fade-in duration-300">
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="forgot-email">Email</Label>
          <div className="relative group">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
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
          icon={<Sparkles className="ml-2 size-4" />}
        >
          Send Reset Link
        </SubmitButton>
        <Button
          type="button"
          variant="ghost"
          className="w-full h-11 hover:bg-white/10"
          onClick={onBackToLogin}
        >
          Back to Sign In
        </Button>
      </form>
    </div>
  );
}
