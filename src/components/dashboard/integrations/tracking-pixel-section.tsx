'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface TrackingPixelSectionProps {
    platform: string;
    pixelId: string;
    accessToken?: string;
    pixelLabel: string;
    tokenLabel?: string;
    onSave: (pixelId: string, token: string) => Promise<void>;
    description?: string;
    children?: React.ReactNode;
}

export function TrackingPixelSection({
    platform,
    pixelId,
    accessToken,
    pixelLabel,
    tokenLabel,
    onSave,
    description,
    children,
}: TrackingPixelSectionProps) {
    const [localPixelId, setLocalPixelId] = useState(pixelId);
    const [localToken, setLocalToken] = useState(accessToken || '');
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(localPixelId, localToken);
            toast({
                title: 'Settings Saved',
                description: `${platform} tracking settings have been updated.`,
            });
        } catch (e) {
            toast({
                title: 'Error',
                description: 'Failed to save settings.',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="glass">
            <CardHeader>
                <CardTitle>{platform} Tracking</CardTitle>
                <CardDescription>
                    {description || 'Configure Pixel and Conversion API for better ad tracking.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">{pixelLabel}</label>
                    <input
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={localPixelId}
                        onChange={(e) => setLocalPixelId(e.target.value)}
                        placeholder={`Enter your ${platform} Pixel ID`}
                    />
                </div>
                {tokenLabel && (
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{tokenLabel}</label>
                        <input
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={localToken}
                            onChange={(e) => setLocalToken(e.target.value)}
                            type="password"
                            placeholder="Enter Access Token"
                        />
                        <p className="text-xs text-muted-foreground">
                            Required for server-side tracking (maximum accuracy).
                        </p>
                    </div>
                )}
                {children}
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </CardContent>
        </Card>
    );
}
