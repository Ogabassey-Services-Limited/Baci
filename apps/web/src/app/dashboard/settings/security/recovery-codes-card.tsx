'use client';

import { Download, KeyRound, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
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
import {
  acknowledgeRecoveryCodesAction,
  generateRecoveryCodesAction,
} from './recovery-codes-actions';

const DOWNLOAD_REVOKE_DELAY_MS = 150;

export function RecoveryCodesCard({ initialCount }: { initialCount: number }) {
  const { toast } = useToast();
  const [count, setCount] = useState(initialCount);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [codeSetId, setCodeSetId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const generate = () => {
    startTransition(async () => {
      const result = await generateRecoveryCodesAction();
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: 'Could not generate codes',
          description: result.error,
        });
        return;
      }
      setCodes(result.codes);
      setCodeSetId(result.codeSetId);
    });
  };

  const acknowledge = () => {
    if (!codeSetId) {
      return;
    }
    const savedCount = codes?.length ?? 0;
    startTransition(async () => {
      const result = await acknowledgeRecoveryCodesAction(codeSetId);
      if (!result.ok) {
        toast({
          variant: 'destructive',
          title: 'Could not save',
          description: result.error,
        });
        return;
      }
      setCount(savedCount);
      setCodes(null);
      setCodeSetId(null);
      toast({ title: 'Recovery codes saved' });
    });
  };

  const copyCodes = () => {
    if (!codes) {
      return;
    }
    void navigator.clipboard?.writeText(codes.join('\n'));
    toast({ title: 'Copied to clipboard' });
  };

  const downloadCodes = () => {
    if (!codes) {
      return;
    }
    const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'baci-recovery-codes.txt';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_REVOKE_DELAY_MS);
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5" />
          Recovery codes
        </CardTitle>
        <CardDescription>
          One-time backup codes to regain access if you lose your passkey. Keep
          them somewhere safe — each works only once.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {codes ? (
          <div className="space-y-3">
            <Alert>
              <AlertDescription>
                These are shown <strong>once</strong>. Save them now — you won't
                be able to see them again.
              </AlertDescription>
            </Alert>
            <ul className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 p-3 font-mono text-sm">
              {codes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={copyCodes}>
                Copy
              </Button>
              <Button type="button" variant="outline" onClick={downloadCodes}>
                <Download className="mr-2 size-4" />
                Download
              </Button>
              <Button type="button" onClick={acknowledge} disabled={isPending}>
                {isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                I've saved these
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {count > 0
                ? `You have ${count} unused recovery ${count === 1 ? 'code' : 'codes'}.`
                : 'You have no recovery codes yet.'}
            </p>
            {count > 0 ? (
              <Alert>
                <AlertDescription>
                  Generating new codes does not replace your existing saved
                  codes until you confirm the new set is saved.
                </AlertDescription>
              </Alert>
            ) : null}
            <Button type="button" onClick={generate} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 size-4" />
              )}
              {count > 0 ? 'Regenerate codes' : 'Generate recovery codes'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
