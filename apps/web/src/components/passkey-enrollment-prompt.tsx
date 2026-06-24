'use client';

import { Fingerprint, Loader2, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import {
  listPasskeys,
  PASSKEY_STATE_CHANGED_EVENT,
  registerPasskey,
} from '@/lib/auth/passkey-client';

const DISMISS_KEY_PREFIX = 'baci.passkey-enroll-prompt.dismissed';

function getDismissKey(userId: string): string {
  return `${DISMISS_KEY_PREFIX}.${userId}`;
}

function isDismissed(dismissKey: string): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      window.localStorage.getItem(dismissKey) === '1'
    );
  } catch {
    return false;
  }
}

function rememberDismissed(dismissKey: string): void {
  try {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(dismissKey, '1');
  } catch {
    // Non-critical preference storage. Blocked storage must not break dashboard.
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
  const { user } = useAuth();
  const pathname = usePathname();
  const { toast } = useToast();
  const isMounted = useRef(true);
  const [visible, setVisible] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const dismissKey = user?.id ? getDismissKey(user.id) : null;

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !dismissKey || !pathname) {
      setVisible(false);
      return;
    }

    let active = true;
    const refreshPasskeyState = async () => {
      if (isDismissed(dismissKey)) {
        if (active) {
          setVisible(false);
        }
        return;
      }

      const { data, error } = await listPasskeys();
      if (!active || error) {
        // Fail quiet — a passkey lookup must never block the dashboard.
        return;
      }
      if (isDismissed(dismissKey)) {
        setVisible(false);
        return;
      }
      setVisible((data ?? []).length === 0);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshPasskeyState();
      }
    };

    void refreshPasskeyState();
    window.addEventListener(PASSKEY_STATE_CHANGED_EVENT, refreshPasskeyState);
    window.addEventListener('focus', refreshPasskeyState);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      window.removeEventListener(
        PASSKEY_STATE_CHANGED_EVENT,
        refreshPasskeyState
      );
      window.removeEventListener('focus', refreshPasskeyState);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [dismissKey, enabled, pathname]);

  if (!visible) {
    return null;
  }

  const dismiss = () => {
    if (dismissKey) {
      rememberDismissed(dismissKey);
    }
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
    setVisible(false);
    toast({
      title: 'Passkey ready',
      description: 'You can now sign in without a password.',
    });
  };

  return (
    <section
      aria-label="Set up a passkey"
      className="glass fixed right-4 bottom-[calc(env(safe-area-inset-bottom)_+_5rem)] left-4 z-[60] flex flex-col gap-3 rounded-xl border border-border/60 p-4 shadow-lg sm:bottom-6 sm:left-auto sm:max-w-xl sm:flex-row sm:items-center sm:justify-between"
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
