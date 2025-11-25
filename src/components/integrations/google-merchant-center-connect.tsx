'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, AlertCircle, RefreshCw, LogOut, ExternalLink, ShoppingBag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface GoogleMerchantCenterConnectProps {
    isConnected?: boolean;
    merchantId?: string;
    lastSyncedAt?: string;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onSync?: () => void;
}

export function GoogleMerchantCenterConnect({
    isConnected = false,
    merchantId,
    lastSyncedAt,
    onConnect,
    onDisconnect,
    onSync
}: GoogleMerchantCenterConnectProps) {
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            // Simulate OAuth flow initiation
            await new Promise(resolve => setTimeout(resolve, 1500));
            onConnect?.();
            toast({
                title: 'Connecting to Google Merchant Center',
                description: 'Redirecting to Google for authentication...',
            });
            // In a real app, this would redirect to the OAuth endpoint
            // window.location.href = '/api/integrations/google-merchant-center/auth';
        } catch (error) {
            toast({
                title: 'Connection Failed',
                description: 'Could not initiate connection. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsConnecting(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            onSync?.();
            toast({
                title: 'Sync Started',
                description: 'Product feed is being updated and pushed to Google Merchant Center.',
            });
        } catch (error) {
            toast({
                title: 'Sync Failed',
                description: 'Could not sync products. Please check your connection.',
                variant: 'destructive',
            });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-white rounded-lg border border-border/60 flex items-center justify-center p-1.5 shadow-sm">
                            {/* Placeholder for Google Logo - using ShoppingBag as fallback */}
                            <ShoppingBag className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-medium">Google Merchant Center</CardTitle>
                            <CardDescription>Sync your products to Google Shopping.</CardDescription>
                        </div>
                    </div>
                    {isConnected ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1.5 py-1">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Connected
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 gap-1.5 py-1">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Not Connected
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pb-4">
                {isConnected ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex flex-col gap-1">
                                <span className="text-muted-foreground">Merchant ID</span>
                                <span className="font-mono font-medium">{merchantId || '---'}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-muted-foreground">Last Synced</span>
                                <span className="font-medium">{lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Never'}</span>
                            </div>
                        </div>

                        <div className="bg-muted/30 rounded-md p-3 text-xs text-muted-foreground flex gap-2 items-start border border-border/40">
                            <InfoIcon className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                            <p>
                                Products with status <strong>Active</strong> and valid <strong>GTIN/MPN</strong> will be automatically synced.
                                Ensure your shipping settings in Google Merchant Center match your store settings.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-muted/20 rounded-lg p-4 text-sm text-muted-foreground border border-border/40">
                        <p className="leading-relaxed">
                            Connect your Google Merchant Center account to automatically list your products on Google Shopping,
                            display free product listings, and run Performance Max campaigns.
                        </p>
                        <ul className="mt-3 space-y-1.5 list-disc list-inside text-xs opacity-90">
                            <li>Automatic inventory synchronization</li>
                            <li>Real-time price updates</li>
                            <li>Rich product data (images, descriptions, attributes)</li>
                        </ul>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/40 pt-4 bg-muted/5">
                {isConnected ? (
                    <>
                        <Button variant="outline" size="sm" onClick={onDisconnect} className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100">
                            <LogOut className="h-3.5 w-3.5 mr-2" />
                            Disconnect
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" asChild>
                                <a href="https://merchants.google.com/" target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3.5 w-3.5 mr-2" />
                                    Open GMC
                                </a>
                            </Button>
                            <Button size="sm" onClick={handleSync} disabled={isSyncing}>
                                {isSyncing ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                        Syncing...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="h-3.5 w-3.5 mr-2" />
                                        Sync Now
                                    </>
                                )}
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="w-full flex justify-end">
                        <Button onClick={handleConnect} disabled={isConnecting} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {isConnecting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    Connect Google Account
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </CardFooter>
        </Card>
    );
}

function InfoIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
        </svg>
    )
}
