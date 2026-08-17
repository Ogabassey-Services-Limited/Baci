'use client';

import { KeyRound, Zap } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  ConnectJumiaManualForm,
  getJumiaShopSelectionId,
} from './connect-jumia-manual-form';
import {
  connectJumiaShops,
  discoverJumiaShops,
  type JumiaDiscoveredShop,
} from './use-jumia-integrations';

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
  const [discovering, setDiscovering] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [clientId, setClientId] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [activeDiscoveryId, setActiveDiscoveryId] = useState('');
  const [discoveredShops, setDiscoveredShops] = useState<JumiaDiscoveredShop[]>(
    []
  );
  const [selectedShopIds, setSelectedShopIds] = useState<Set<string>>(
    new Set()
  );

  const resetManualForm = () => {
    setClientId('');
    setRefreshToken('');
    setActiveDiscoveryId('');
    setDiscoveredShops([]);
    setSelectedShopIds(new Set());
  };

  const clearDiscoveryState = () => {
    setActiveDiscoveryId('');
    setDiscoveredShops([]);
    setSelectedShopIds(new Set());
  };

  const handleDiscover = async () => {
    if (!clientId.trim() || !refreshToken.trim()) return;

    setDiscovering(true);
    const result = await discoverJumiaShops(clientId, refreshToken);
    setDiscovering(false);

    if (!result.ok) {
      clearDiscoveryState();
      toast({
        title: 'Discovery failed',
        description: result.error,
        variant: 'destructive',
      });
      return;
    }

    const shops = result.shops ?? [];
    if (!result.discoveryId) {
      clearDiscoveryState();
      toast({
        title: 'Discovery failed',
        description: 'Shop discovery failed',
        variant: 'destructive',
      });
      return;
    }

    setDiscoveredShops(shops);
    setActiveDiscoveryId(result.discoveryId);
    setSelectedShopIds(
      new Set(
        shops
          .filter((shop) => !shop.alreadyConnected)
          .map((shop) => getJumiaShopSelectionId(shop))
      )
    );

    if (shops.length === 0) {
      toast({
        title: 'No shops found',
        description: 'Jumia did not return any shops for this authorization.',
        variant: 'destructive',
      });
    }
  };

  const handleConnectSelected = async () => {
    if (selectedShopIds.size === 0 || !activeDiscoveryId) return;

    setConnecting(true);
    const result = await connectJumiaShops(
      clientId,
      activeDiscoveryId,
      Array.from(selectedShopIds)
    );
    setConnecting(false);

    if (result.ok) {
      toast({ title: 'Jumia account connected successfully!' });
      onOpenChange(false);
      resetManualForm();
      setShowManualForm(false);
      onConnected();
      return;
    }

    toast({
      title: 'Connection failed',
      description: result.error,
      variant: 'destructive',
    });
  };

  const toggleShop = (shopId: string, disabled: boolean) => {
    if (disabled) return;
    setSelectedShopIds((current) => {
      const next = new Set(current);
      if (next.has(shopId)) next.delete(shopId);
      else next.add(shopId);
      return next;
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetManualForm();
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

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowManualForm(!showManualForm)}
          >
            <KeyRound className="size-4 mr-2" />
            {showManualForm ? 'Hide Manual Entry' : 'Enter Refresh Token'}
          </Button>

          {showManualForm && (
            <ConnectJumiaManualForm
              clientId={clientId}
              refreshToken={refreshToken}
              discovering={discovering}
              connecting={connecting}
              discoveredShops={discoveredShops}
              selectedShopIds={selectedShopIds}
              onClientIdChange={(value) => {
                setClientId(value);
                clearDiscoveryState();
              }}
              onRefreshTokenChange={(value) => {
                setRefreshToken(value);
                clearDiscoveryState();
              }}
              onDiscover={handleDiscover}
              onConnectSelected={handleConnectSelected}
              onToggleShop={toggleShop}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
