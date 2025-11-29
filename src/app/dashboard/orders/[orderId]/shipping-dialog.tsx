'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Truck,
  User,
  Clock,
  Shield,
  MapPin,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiPost } from '@/lib/api-client';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface ShippingQuote {
  id: string;
  provider: 'GIGL' | 'TOPSHIP' | 'SHIIP';
  serviceTier: string;
  carrierName: string;
  displayName: string;
  estimatedDays: number;
  minDays?: number;
  maxDays?: number;
  price: number;
  currency: string;
  pickupIncluded: boolean;
  insuranceIncluded: boolean;
  isStationPickup?: boolean;
  stationName?: string;
  stationAddress?: string;
  providerRateId?: string;
}

interface QuoteResponse {
  quotes: {
    featured: ShippingQuote[];
    all: ShippingQuote[];
  };
  sessionId: string;
  expiresAt: string;
  warnings?: string[];
}

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
  orderId,
  orderNumber,
  customerName,
  customerPhone,
  customerEmail,
  shippingAddress,
  items,
  selfFulfillmentEnabled,
  formatCurrency,
  onShipmentBooked,
}: ShippingDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'provider' | 'self'>('provider');

  // Provider fulfillment state
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [, setSessionId] = useState<string | null>(null); // Reserved for future quote session management
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  // Self-fulfillment state
  const [selfTrackingNumber, setSelfTrackingNumber] = useState('');
  const [selfDispatchPhone, setSelfDispatchPhone] = useState('');
  const [selfCarrierName, setSelfCarrierName] = useState('');
  const [selfNotes, setSelfNotes] = useState('');
  const [selfSubmitting, setSelfSubmitting] = useState(false);

  // Fetch quotes
  const fetchQuotes = async () => {
    setLoadingQuotes(true);
    try {
      const response = await apiPost<QuoteResponse>('/api/shipping/quotes', {
        receiver: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          address: shippingAddress.address,
          city: shippingAddress.city,
          state: shippingAddress.state,
          country: 'Nigeria',
          countryCode: 'NG',
        },
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          weight: item.weight || 1,
          value: item.price,
        })),
        shipmentType: 'domestic',
      });

      setQuotes(response.quotes.all);
      setSessionId(response.sessionId);

      // Auto-select first quote
      if (response.quotes.featured.length > 0) {
        setSelectedQuoteId(response.quotes.featured[0].id);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to fetch quotes',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoadingQuotes(false);
    }
  };

  // Book shipment with provider
  const handleBookShipment = async () => {
    if (!selectedQuoteId) {
      toast({ variant: 'destructive', title: 'Please select a delivery option' });
      return;
    }

    setBooking(true);
    try {
      const response = await apiPost<{
        success: boolean;
        shipment: {
          trackingNumber: string;
          carrier: string;
          providerShipmentId: string;
        };
      }>('/api/shipping/book', {
        orderId,
        quoteId: selectedQuoteId,
        receiver: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          address: shippingAddress.address,
          city: shippingAddress.city,
          state: shippingAddress.state,
          country: 'Nigeria',
          countryCode: 'NG',
        },
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          weight: item.weight || 1,
          value: item.price,
        })),
      });

      toast({
        title: 'Shipment Booked!',
        description: `Tracking number: ${response.shipment.trackingNumber}`,
      });

      const selectedQuote = quotes.find(q => q.id === selectedQuoteId);
      onShipmentBooked(
        response.shipment.trackingNumber,
        response.shipment.carrier,
        selectedQuote?.provider || 'GIGL'
      );
      onClose();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Booking Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setBooking(false);
    }
  };

  // Self-fulfill order
  const handleSelfFulfill = async () => {
    if (!selfDispatchPhone) {
      toast({ variant: 'destructive', title: 'Dispatch phone number is required' });
      return;
    }

    setSelfSubmitting(true);
    try {
      await apiPost('/api/shipping/self-fulfill', {
        orderId,
        trackingNumber: selfTrackingNumber || undefined,
        dispatchPhone: selfDispatchPhone,
        carrierName: selfCarrierName || undefined,
        dispatchNotes: selfNotes || undefined,
      });

      toast({
        title: 'Order Marked as Shipped',
        description: 'Self-fulfillment details have been saved.',
      });

      onShipmentBooked(
        selfTrackingNumber || 'Self-Delivery',
        selfCarrierName || 'Self-Delivery',
        'SELF'
      );
      onClose();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to save fulfillment',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSelfSubmitting(false);
    }
  };

  // Generate WhatsApp message for rider
  const generateRiderMessage = () => {
    const itemsList = items.map(i => `- ${i.name} (x${i.quantity})`).join('\n');
    return encodeURIComponent(
      `Delivery Details for Order ${orderNumber}\n\n` +
      `Customer: ${customerName}\n` +
      `Phone: ${customerPhone}\n` +
      `Address: ${shippingAddress.address}, ${shippingAddress.city}, ${shippingAddress.state}\n\n` +
      `Items:\n${itemsList}\n\n` +
      (selfNotes ? `Special Instructions: ${selfNotes}` : '')
    );
  };

  // Format delivery time
  const formatDeliveryTime = (quote: ShippingQuote) => {
    if (quote.minDays && quote.maxDays && quote.minDays !== quote.maxDays) {
      return `${quote.minDays}-${quote.maxDays} days`;
    }
    return `${quote.estimatedDays} day${quote.estimatedDays > 1 ? 's' : ''}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ship Order {orderNumber}</DialogTitle>
          <DialogDescription>
            Choose a shipping provider or fulfill this order yourself.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'provider' | 'self')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="provider" className="gap-2">
              <Truck className="h-4 w-4" />
              Shipping Provider
            </TabsTrigger>
            {selfFulfillmentEnabled && (
              <TabsTrigger value="self" className="gap-2">
                <User className="h-4 w-4" />
                Self-Fulfill
              </TabsTrigger>
            )}
          </TabsList>

          {/* Provider Fulfillment Tab */}
          <TabsContent value="provider" className="space-y-4 pt-4">
            {quotes.length === 0 && !loadingQuotes && (
              <div className="text-center py-8">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Get shipping quotes from multiple carriers
                </p>
                <Button onClick={fetchQuotes}>
                  Get Delivery Options
                </Button>
              </div>
            )}

            {loadingQuotes && (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Finding best delivery options...</p>
              </div>
            )}

            {quotes.length > 0 && (
              <RadioGroup
                value={selectedQuoteId || ''}
                onValueChange={setSelectedQuoteId}
                className="space-y-3"
              >
                {quotes.map((quote, index) => (
                  <Label
                    key={quote.id}
                    htmlFor={quote.id}
                    className={cn(
                      "flex cursor-pointer rounded-lg border p-4 transition-all hover:bg-muted/50",
                      selectedQuoteId === quote.id ? "border-primary bg-primary/5" : "border-border"
                    )}
                  >
                    <RadioGroupItem value={quote.id} id={quote.id} className="sr-only" />

                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{quote.carrierName}</span>
                            {index === 0 && (
                              <Badge variant="default" className="text-xs">Best Value</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {formatDeliveryTime(quote)}
                            </span>
                            {quote.insuranceIncluded && (
                              <span className="flex items-center gap-1">
                                <Shield className="h-3.5 w-3.5" />
                                Insured
                              </span>
                            )}
                          </div>

                          {quote.isStationPickup && quote.stationName && (
                            <div className="flex items-start gap-1 text-sm text-amber-600 mt-2">
                              <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                              <span>Pickup at: {quote.stationName}</span>
                            </div>
                          )}
                        </div>

                        <p className="font-semibold text-lg">{formatCurrency(quote.price)}</p>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "ml-4 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        selectedQuoteId === quote.id ? "border-primary bg-primary" : "border-muted-foreground/30"
                      )}
                    >
                      {selectedQuoteId === quote.id && (
                        <div className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            )}

            {quotes.length > 0 && (
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleBookShipment}
                  disabled={!selectedQuoteId || booking}
                >
                  {booking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Book Shipment
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Self-Fulfillment Tab */}
          {selfFulfillmentEnabled && (
            <TabsContent value="self" className="space-y-4 pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dispatchPhone">Dispatch Phone Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="dispatchPhone"
                      placeholder="Enter rider's phone number"
                      value={selfDispatchPhone}
                      onChange={(e) => setSelfDispatchPhone(e.target.value)}
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
                    value={selfTrackingNumber}
                    onChange={(e) => setSelfTrackingNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="carrierName">Carrier Name (Optional)</Label>
                  <Input
                    id="carrierName"
                    placeholder="e.g., GIG Logistics, DHL, or your dispatch name"
                    value={selfCarrierName}
                    onChange={(e) => setSelfCarrierName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Special Instructions (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any special delivery instructions for the rider"
                    value={selfNotes}
                    onChange={(e) => setSelfNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex justify-between pt-4">
                  {selfDispatchPhone && (
                    <Button
                      variant="outline"
                      asChild
                    >
                      <a
                        href={`https://wa.me/${selfDispatchPhone.replace(/\D/g, '')}?text=${generateRiderMessage()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Send to Rider
                      </a>
                    </Button>
                  )}
                  <Button
                    onClick={handleSelfFulfill}
                    disabled={!selfDispatchPhone || selfSubmitting}
                    className="ml-auto"
                  >
                    {selfSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
