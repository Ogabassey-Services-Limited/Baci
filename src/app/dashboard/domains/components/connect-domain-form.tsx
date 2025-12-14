'use client';

import { Copy, Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export function ConnectDomainForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [input, setInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [verificationInfo, setVerificationInfo] = useState<{
    domain: string;
    token: string;
  } | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Verification token copied to clipboard.',
    });
  };

  const handleAdd = async () => {
    if (!input.trim()) {
      toast({
        title: 'Invalid Domain',
        description: 'Please enter a valid domain name.',
        variant: 'destructive',
      });
      return;
    }

    setIsAdding(true);
    setVerificationInfo(null);

    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: input.trim().toLowerCase(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Domain Added! 🎉',
          description:
            'Your custom domain has been added. Please verify ownership.',
        });

        setVerificationInfo({
          domain: data.domain.domain,
          token: data.verification.value,
        });

        setInput('');
        router.refresh();
      } else {
        toast({
          title: 'Failed to Add Domain',
          description: data.error || 'Could not add domain. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error adding domain:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while adding the domain.',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Existing Domain</CardTitle>
        <CardDescription>
          Enter the domain name you own (e.g., example.com) to connect it to
          your store.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="example.com"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            disabled={isAdding}
          />
          <Button onClick={handleAdd} disabled={isAdding}>
            {isAdding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Connect
          </Button>
        </div>

        {verificationInfo && (
          <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <AlertTitle className="mb-2">Verification Required</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                To verify ownership of{' '}
                <strong>{verificationInfo.domain}</strong>, please add the
                following TXT record to your DNS settings:
              </p>
              <div className="grid gap-2 p-3 bg-white dark:bg-black/40 rounded border text-sm">
                <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                  <span className="font-semibold text-muted-foreground">
                    Type:
                  </span>
                  <span className="font-mono">TXT</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                  <span className="font-semibold text-muted-foreground">
                    Host:
                  </span>
                  <span className="font-mono">@</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                  <span className="font-semibold text-muted-foreground">
                    Value:
                  </span>
                  <div className="flex items-center gap-2">
                    <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded break-all">
                      {verificationInfo.token}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(verificationInfo.token)}
                    >
                      <Copy className="w-3 h-3" />
                      <span className="sr-only">Copy token</span>
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Note: DNS changes can take up to 24 hours to propagate.
              </p>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
