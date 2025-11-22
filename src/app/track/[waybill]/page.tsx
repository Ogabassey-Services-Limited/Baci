
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { trackGiglShipment } from '@/lib/gigl';
import { Loader2, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TrackingStatus {
    Status: string;
    ScanStatusReason: string;
    DateTime: string;
    DepartureServiceCentre?: {
        Name: string;
    };
}

interface ShipmentData {
    Waybill: string;
    Origin: string;
    Destination: string;
    MobileShipmentTrackings: TrackingStatus[];
}

export default function TrackingPage() {
    const params = useParams();
    const waybill = params.waybill as string;
    const [shipment, setShipment] = useState<ShipmentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (waybill) {
            const fetchTrackingData = async () => {
                setLoading(true);
                setError(null);
                try {
                    const result = await trackGiglShipment(waybill);
                    if (result.status === 200 && result.data && result.data.length > 0) {
                        setShipment(result.data[0]);
                    } else {
                        throw new Error(result.message || 'Shipment not found.');
                    }
                } catch (err) {
                    setError((err as Error).message);
                } finally {
                    setLoading(false);
                }
            };
            fetchTrackingData();
        }
    }, [waybill]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-4">Loading tracking information...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center text-red-500">
                <p>Error: {error}</p>
            </div>
        );
    }

    if (!shipment) {
        return (
            <div className="flex h-screen items-center justify-center">
                <p>No shipment information found for waybill: {waybill}</p>
            </div>
        );
    }

    const latestStatus = shipment.MobileShipmentTrackings[shipment.MobileShipmentTrackings.length - 1];

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="container mx-auto max-w-4xl py-12 px-4">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-2xl">Tracking Details</CardTitle>
                                <p className="text-muted-foreground font-mono">{shipment.Waybill}</p>
                            </div>
                            <Badge variant="secondary">{latestStatus.Status}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid md:grid-cols-2 gap-6 mb-8">
                            <div>
                                <p className="text-sm text-muted-foreground">Origin</p>
                                <p className="font-medium">{shipment.Origin}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Destination</p>
                                <p className="font-medium">{shipment.Destination}</p>
                            </div>
                        </div>

                        <div className="space-y-8 relative">
                            {/* Dotted line */}
                            <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gray-200 border-l-2 border-dashed"></div>

                            {shipment.MobileShipmentTrackings.map((status, index) => (
                                <div key={index} className="flex items-start gap-4 relative">
                                    <div className="flex-shrink-0 z-10">
                                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                                            <Package className="h-5 w-5 text-white" />
                                        </div>
                                    </div>
                                    <div className="flex-1 pt-1.5">
                                        <p className="font-semibold">{status.ScanStatusReason}</p>
                                        {status.DepartureServiceCentre && <p className="text-sm text-muted-foreground">{status.DepartureServiceCentre.Name}</p>}
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {new Date(status.DateTime).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
