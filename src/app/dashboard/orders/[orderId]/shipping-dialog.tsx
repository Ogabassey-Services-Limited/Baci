'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Truck,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  weight?: number;
}

interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  address: string;
  city: string;
  state: string;
  phone?: string;
}

interface ShippingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: ShippingAddress;
  items: OrderItem[];
  selfFulfillmentEnabled: boolean;
  formatCurrency: (amount: number) => string;
  onShipmentBooked: (trackingNumber: string, carrier: string, provider: string) => void;
}

// =============================================================================
// SHIPPING DIALOG COMPONENT
// =============================================================================

export function ShippingDialog({
  isOpen,
  onClose,
  orderNumber,
  selfFulfillmentEnabled,
}: ShippingDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ship Order {orderNumber}</DialogTitle>
          <DialogDescription>
            Choose a shipping provider or fulfill this order yourself.
          </DialogDescription>
        </DialogHeader>

        <Tabs value="provider" onValueChange={() => { }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="provider" className="gap-2">
              <Truck className="h-4 w-4" />
              Shipping Provider
            </TabsTrigger>
            {selfFulfillmentEnabled && (
              <TabsTrigger value="self" className="gap-2">
                {/* User icon removed from lucide-react import */}
                Self-Fulfill
              </TabsTrigger>
            )}
          </TabsList>

          {/* Provider Fulfillment Tab */}
          <TabsContent value="provider" className="space-y-4 pt-4">
            <div className="text-center py-8">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Get shipping quotes from multiple carriers
              </p>
              <Button onClick={() => { }}>
                Get Delivery Options
              </Button>
            </div>

            {/* Quotes display and booking logic removed */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={() => { }}
                disabled={true}
              >
                Book Shipment
              </Button>
            </div>
          </TabsContent>

          {/* Self-Fulfillment Tab */}
          {selfFulfillmentEnabled && (
            <TabsContent value="self" className="space-y-4 pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dispatchPhone">Dispatch Phone Number *</Label>
                  <div className="relative">
                    {/* Phone icon removed from lucide-react import */}
                    <Input
                      id="dispatchPhone"
                      placeholder="Enter rider's phone number"
                      value=""
                      onChange={() => { }}
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This will be used to send delivery details to your rider
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trackingNumber">Tracking Number (Optional)</Label>
                  <Input
                    id="trackingNumber"
                    placeholder="Enter tracking number if available"
                    value=""
                    onChange={() => { }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="carrierName">Carrier Name (Optional)</Label>
                  <Input
                    id="carrierName"
                    placeholder="GIG Logistics, DHL, or your dispatch name"
                    value=""
                    onChange={() => { }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Special Instructions (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any special delivery instructions for the rider"
                    value=""
                    onChange={() => { }}
                    rows={3}
                  />
                </div>

                <div className="flex justify-between pt-4">
                  <Button
                    onClick={() => { }}
                    disabled={true}
                    className="ml-auto"
                  >
                    Mark as Shipped
                  </Button>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
