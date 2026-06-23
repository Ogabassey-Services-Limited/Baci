'use client';

import { Fingerprint, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { listPasskeys, registerPasskey } from '@/lib/auth/passkey-client';

const DISMISS_KEY = 'baci.passkey-enroll-prompt.dismissed';

function isDismissed(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.localStorage.getItem(DISMISS_KEY) === '1'
  );
}

function rememberDismissed(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DISMISS_KEY, '1');
  }
}

/**
 * Post-login nudge that invites merchants who have no passkey yet to enrol one
 * with a single tap. Most merchants never open Settings, so this is the main
 * discovery surface for passwordless sign-in. Renders nothing unless the
 * passkey flag is on, the user has zero passkeys, and they haven't dismissed it.
 */
export function PasskeyEnrollmentPrompt() {
  const enabled =
    process.env.NEXT_PUBLIC_SUPABASE_PASSKEY_AUTH_ENABLED === 'true';
  const { toast } = useToast();
  const isMounted = useRef(false);
  const [visible, setVisible] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || isDismissed()) {
      return;
    }
    let active = true;
    void (async () => {
      const { data, error } = await listPasskeys();
      if (!active || error) {
        // Fail quiet — a passkey lookup must never block the dashboard.
        return;
      }
      if ((data ?? []).length === 0) {
        setVisible(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled]);

  if (!visible) {
    return null;
  }

  const dismiss = () => {
    rememberDismissed();
    setVisible(false);
  };

  const enroll = async () => {
    setIsPending(true);
    const { error } = await registerPasskey();
    if (!isMounted.current) {
      return;
    }
    setIsPending(false);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Could not set up passkey',
        description: error.message,
      });
      return;
    }
    rememberDismissed();
    setVisible(false);
    toast({
      title: 'Passkey ready',
      description: 'You can now sign in without a password.',
    });
  };

  return (
    <section
      aria-label="Set up a passkey"
      className="glass fixed right-4 bottom-4 left-4 z-50 flex flex-col gap-3 rounded-xl border border-border/60 p-4 shadow-lg sm:left-auto sm:max-w-xl sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <Fingerprint className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Sign in faster next time</p>
          <p className="text-sm text-muted-foreground">
            Set up a passkey to log in with your fingerprint, face, or device
            PIN — no password to remember.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" onClick={enroll} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Fingerprint className="mr-2 size-4" />
          )}
          Set up passkey
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={dismiss}
          disabled={isPending}
          aria-label="Dismiss passkey setup"
        >
          <X className="size-4" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Not now</span>
        </Button>
      </div>
    </section>
  );
}
