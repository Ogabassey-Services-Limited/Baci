'use client';

import { KeyRound, Loader2, Zap } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { connectWithToken } from './use-jumia-integrations';

interface ConnectJumiaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
}

export function ConnectJumiaDialog({
  open,
  onOpenChange,
  onConnected,
}: ConnectJumiaDialogProps) {
  const { toast } = useToast();
  const [showManualForm, setShowManualForm] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [refreshToken, setRefreshToken] = useState('');
  const [shopName, setShopName] = useState('');

  const handleManualConnect = async () => {
    if (!refreshToken.trim()) return;

    setConnecting(true);
    const result = await connectWithToken(refreshToken, shopName);
    setConnecting(false);

    if (result.ok) {
      toast({ title: 'Jumia account connected successfully!' });
      onOpenChange(false);
      setRefreshToken('');
      setShopName('');
      onConnected();
    } else {
      toast({
        title: 'Connection failed',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setRefreshToken('');
      setShopName('');
      setShowManualForm(false);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Jumia Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* OAuth (Primary) */}
          <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-900/10 dark:border-orange-900/30">
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center gap-2 font-semibold">
                <Zap className="size-5 text-orange-500" />
                Fast Connection
              </div>
              <p className="text-sm text-muted-foreground">
                Log in to your Jumia Vendor Center account to connect
                automatically.
              </p>
              <Button
                className="w-full bg-[#f68b1e] hover:bg-[#e07e1b]"
                asChild
              >
                <a href="/api/marketplace/jumia/connect?connectionType=oauth">
                  Connect with Jumia
                </a>
              </Button>
            </CardContent>
          </Card>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or connect manually
              </span>
            </div>
          </div>

          {/* Manual Token */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowManualForm(!showManualForm)}
          >
            <KeyRound className="size-4 mr-2" />
            {showManualForm ? 'Hide Manual Entry' : 'Enter Refresh Token'}
          </Button>

          {showManualForm && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-xs text-muted-foreground p-3 bg-muted rounded-md">
                Go to <strong>Settings &rarr; Applications</strong> in Jumia
                Vendor Center, create a &ldquo;Self Authorization&rdquo; app,
                and copy the token.
              </p>

              <div className="space-y-2">
                <Label htmlFor="shopName">Shop Name (optional)</Label>
                <Input
                  id="shopName"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="My Jumia Shop"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="refreshToken">Refresh Token</Label>
                <Textarea
                  id="refreshToken"
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  placeholder="Paste your token..."
                  rows={2}
                  className="font-mono text-sm"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleManualConnect}
                disabled={connecting || !refreshToken.trim()}
              >
                {connecting && <Loader2 className="size-4 mr-2 animate-spin" />}
                {connecting ? 'Connecting...' : 'Connect Token'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
