'use client';

import { ArrowRight, KeyRound, Mail } from 'lucide-react';
import type { AuthActionState } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import type { LoginFormAction, LoginMode } from './login-form-types';

type LoginPasswordlessEntryProps = {
  email: string;
  mode: Extract<LoginMode, 'passwordless-request' | 'passwordless-verify'>;
  onBackToLogin: () => void;
  onUseDifferentEmail: () => void;
  redirectTo: string;
  sendAction: LoginFormAction;
  sendState: AuthActionState;
  verifyAction: LoginFormAction;
  verifyState: AuthActionState;
};

export function LoginPasswordlessEntry({
  email,
  mode,
  onBackToLogin,
  onUseDifferentEmail,
  redirectTo,
  sendAction,
  sendState,
  verifyAction,
  verifyState,
}: LoginPasswordlessEntryProps) {
  if (mode === 'passwordless-request') {
    return (
      <div className="animate-in fade-in duration-300">
        <form action={sendAction} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="space-y-2">
            <Label htmlFor="passwordless-email">Email</Label>
            <div className="relative group">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                id="passwordless-email"
                name="email"
                type="email"
                placeholder="name@example.com"
                required
                defaultValue={email}
                className="pl-10 h-11 bg-white/50 dark:bg-black/20 border-primary/10 focus:border-primary/50 transition-all"
                autoComplete="email"
              />
            </div>
          </div>
          <SubmitButton
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-[1.02]"
            pendingText="Sending..."
            icon={<Mail className="ml-2 size-4" />}
          >
            Send Sign-in Code
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

  return (
    <div className="animate-in fade-in duration-300">
      <form action={verifyAction} className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input
          type="hidden"
          name="email"
          value={verifyState.email || sendState.email || email}
        />
        <div className="space-y-2">
          <Label htmlFor="passwordless-token">Code</Label>
          <div className="relative group">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              id="passwordless-token"
              name="token"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              required
              className="pl-10 h-11 bg-white/50 dark:bg-black/20 border-primary/10 focus:border-primary/50 transition-all tracking-[0.3em]"
              autoComplete="one-time-code"
            />
          </div>
        </div>
        <SubmitButton
          className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-[1.02]"
          pendingText="Verifying..."
          icon={<ArrowRight className="ml-2 size-4" />}
        >
          Verify Code
        </SubmitButton>
        <Button
          type="button"
          variant="ghost"
          className="w-full h-11 hover:bg-white/10"
          onClick={onUseDifferentEmail}
        >
          Use a different email
        </Button>
      </form>
    </div>
  );
}
