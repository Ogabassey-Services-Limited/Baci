'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { createClient } from '@/lib/supabase/client';

interface CheckoutAuthModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface SubmitCheckoutLoginParams {
  supabase: ReturnType<typeof createClient>;
  email: string;
  password: string;
  onSuccess: () => void;
  onOpenChange: (open: boolean) => void;
  setError: (error: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
}

async function submitCheckoutLogin({
  supabase,
  email,
  password,
  onSuccess,
  onOpenChange,
  setError,
  setIsLoading,
}: SubmitCheckoutLoginParams) {
  setIsLoading(true);
  setError(null);

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    onSuccess();
    onOpenChange(false);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to sign in');
  } finally {
    setIsLoading(false);
  }
}

export function CheckoutAuthModal({
  isOpen,
  onOpenChange,
  onSuccess,
}: CheckoutAuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    void submitCheckoutLogin({
      supabase,
      email,
      password,
      onSuccess,
      onOpenChange,
      setError,
      setIsLoading,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Sign In</DialogTitle>
          <DialogDescription>
            Sign in to access your saved address and faster checkout.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleLogin} className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2
                  className="mr-2 size-4 animate-spin"
                  aria-hidden="true"
                />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </Button>
          <p className="sr-only" role="status" aria-live="polite">
            {isLoading ? 'Signing in.' : ''}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
