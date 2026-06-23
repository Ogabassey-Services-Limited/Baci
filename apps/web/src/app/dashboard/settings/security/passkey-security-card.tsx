'use client';

import { Fingerprint, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';

type PasskeyMetadata = {
  created_at: string;
  friendly_name?: string;
  id: string;
  last_used_at?: string;
};

type PasskeyResult<T> = Promise<{
  data: T | null;
  error: { message: string } | null;
}>;

type ToastFn = ReturnType<typeof useToast>['toast'];

type SupabaseAuthWithPasskeys = {
  passkey?: {
    delete?: (input: { passkeyId: string }) => PasskeyResult<unknown>;
    list?: () => PasskeyResult<PasskeyMetadata[]>;
  };
  registerPasskey?: () => PasskeyResult<PasskeyMetadata>;
};

function getPasskeyApi(): SupabaseAuthWithPasskeys {
  const supabase = createClient();
  return supabase.auth as typeof supabase.auth & SupabaseAuthWithPasskeys;
}

async function loadPasskeys({
  setIsLoading,
  setPasskeys,
  toast,
}: {
  setIsLoading: (value: boolean) => void;
  setPasskeys: (value: PasskeyMetadata[]) => void;
  toast: ToastFn;
}) {
  setIsLoading(true);
  const passkeyApi = getPasskeyApi();
  if (!passkeyApi.passkey?.list) {
    setIsLoading(false);
    toast({
      variant: 'destructive',
      title: 'Passkeys Unavailable',
      description: 'Passkey support is not enabled for this client.',
    });
    return;
  }

  const { data, error } = await passkeyApi.passkey.list();
  setIsLoading(false);

  if (error) {
    toast({
      variant: 'destructive',
      title: 'Could Not Load Passkeys',
      description: error.message,
    });
    return;
  }

  setPasskeys(data ?? []);
}

export function PasskeySecurityCard() {
  const { toast } = useToast();
  const [passkeys, setPasskeys] = useState<PasskeyMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    void loadPasskeys({ setIsLoading, setPasskeys, toast });
  }, [toast]);

  const registerPasskey = async () => {
    setIsMutating(true);
    const passkeyApi = getPasskeyApi();

    try {
      if (!passkeyApi.registerPasskey) {
        throw new Error('Passkey registration is not available.');
      }

      const { error } = await passkeyApi.registerPasskey();
      if (error) {
        throw new Error(error.message);
      }

      await loadPasskeys({ setIsLoading, setPasskeys, toast });
      toast({
        title: 'Passkey Added',
        description: 'Your new authenticator is ready for sign-in.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could Not Add Passkey',
        description:
          error instanceof Error
            ? error.message
            : 'Passkey registration failed.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  const deletePasskey = async (passkeyId: string) => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Remove this passkey? If it is your only remaining authenticator, you may lose passwordless sign-in access.'
      )
    ) {
      return;
    }

    setIsMutating(true);
    const passkeyApi = getPasskeyApi();

    try {
      if (!passkeyApi.passkey?.delete) {
        throw new Error('Passkey deletion is not available.');
      }

      const { error } = await passkeyApi.passkey.delete({ passkeyId });
      if (error) {
        throw new Error(error.message);
      }

      await loadPasskeys({ setIsLoading, setPasskeys, toast });
      toast({
        title: 'Passkey Removed',
        description: 'The authenticator was removed from your account.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could Not Remove Passkey',
        description:
          error instanceof Error ? error.message : 'Passkey removal failed.',
      });
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="size-5" />
          Passkeys
        </CardTitle>
        <CardDescription>
          Add at least two authenticators before relying on passkeys for admin
          sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {passkeys.length < 2 && (
          <Alert>
            <Fingerprint className="size-4" />
            <AlertDescription>
              Register a second passkey or hardware key before treating email as
              recovery-only.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading passkeys
          </div>
        ) : (
          <div className="space-y-2">
            {passkeys.map((passkey) => (
              <div
                key={passkey.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {passkey.friendly_name || 'Passkey'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Added {new Date(passkey.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void deletePasskey(passkey.id)}
                  disabled={isMutating}
                  aria-label="Remove passkey"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button type="button" onClick={registerPasskey} disabled={isMutating}>
          {isMutating ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Fingerprint className="mr-2 size-4" />
          )}
          Add Passkey
        </Button>
      </CardContent>
    </Card>
  );
}
