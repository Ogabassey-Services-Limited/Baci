
'use client';

import {
  ChevronLeft,
  MoreVertical,
  Copy,
  Edit,
  Share2,
  XCircle,
  Download,
  Package,
  AlertTriangle,
  Mail,
  Phone,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { initialOrders } from '../page'; // Reusing mock data from orders list
import { notFound, useParams } from 'next/navigation';
import { useMerchant } from '@/hooks/use-merchant';
import { getCountryByCode } from '@/lib/countries';
import { StatusBadge, SourceIcon } from '../page';
import { Separator } from '@/components/ui/separator';
import { products } from '@/lib/products';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


export default function OrderDetailsPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  
  // Find the order from the mock data
  const order = initialOrders.find(o => o.orderNumber.replace('#', '') === orderId);
  const productDetails = products[0]; // For demonstration, using the first product

  const { merchant } = useMerchant();

  if (!order) {
    return notFound();
  }

  const formatCurrency = (amount: number) => {
    const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';
    return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'symbol' }).format(amount);
  };
  
  const shippingFee = 0;
  const taxes = 0;
  const totalAmount = order.total + shippingFee + taxes;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/orders">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Back to Orders</span>
          </Button>
        </Link>
        <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
          Order {order.orderNumber}
        </h1>
        <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1">
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1">
                <XCircle className="h-3.5 w-3.5" />
                <span>Cancel</span>
            </Button>
             <Button size="sm" className="gap-1">
                <Edit className="h-3.5 w-3.5" />
                <span>Edit</span>
            </Button>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid auto-rows-max items-start gap-4 md:col-span-2">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                             <CardTitle>Order Details</CardTitle>
                             <CardDescription>Date: {order.date}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <StatusBadge status={order.paymentStatus} type="payment" />
                            <StatusBadge status={order.shippingStatus} type="shipping" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Channel</p>
                            <div className="flex items-center gap-2 mt-1">
                                <SourceIcon source={order.source} />
                                <p className="font-semibold capitalize">{order.source}</p>
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Customer</p>
                            <p className="font-semibold">{order.customerName}</p>
                        </div>
                         <div>
                            <p className="text-sm font-medium text-muted-foreground">Billing Address</p>
                            <p className="text-sm">Oko-awo Street (Building 5), VI opposite Eko hotel, Nigeria</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Contact Details</p>
                            <div className="flex items-center gap-2 text-sm mt-1">
                                <Phone className="w-4 h-4 text-muted-foreground"/>
                                <span>09035576078</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm mt-1">
                                <Mail className="w-4 h-4 text-muted-foreground"/>
                                <span>arinze.medu@gmail.com</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Products</CardTitle>
                     <CardDescription>
                        <Alert variant="destructive" className="mt-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>1 product(s) requires your attention</AlertTitle>
                            <AlertDescription>
                                Unavailable Stock Qty: 1
                            </AlertDescription>
                        </Alert>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="flex items-center gap-4">
                        <Image src={productDetails.image} alt={productDetails.name} width={64} height={64} className="rounded-md object-cover"/>
                        <div className="flex-1">
                            <p className="font-semibold">{productDetails.name}</p>
                            <p className="text-sm text-muted-foreground">1 x {formatCurrency(order.total)}</p>
                        </div>
                        <p className="font-semibold">{formatCurrency(order.total)}</p>
                     </div>
                </CardContent>
                 <CardFooter className="flex gap-2">
                    <Button variant="outline">Refund Entire Order</Button>
                    <Button>Fulfill Order</Button>
                </CardFooter>
            </Card>
            <Card>
                 <CardHeader>
                    <CardTitle>Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No transactions found for this order.</p>
                </CardContent>
            </Card>
        </div>

        <div className="grid auto-rows-max items-start gap-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Payment Summary</CardTitle>
                    <Button variant="outline" size="sm" className="gap-1">
                        <Download className="h-3.5 w-3.5" />
                        Download Receipt
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between"><span>Sub Total</span> <span>{formatCurrency(order.total)}</span></div>
                    <div className="flex justify-between"><span>Shipping Fee</span> <span>{formatCurrency(shippingFee)}</span></div>
                    <div className="flex justify-between"><span>Taxes</span> <span>{formatCurrency(taxes)}</span></div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg"><span>Total Amount</span> <span>{formatCurrency(totalAmount)}</span></div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Payment Status</CardTitle></CardHeader>
                <CardContent>
                    <StatusBadge status={order.paymentStatus} type="payment" />
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Shipping</CardTitle>
                    <div className="flex items-center gap-1">
                        <StatusBadge status={order.shippingStatus} type="shipping" />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem>Mark as Shipped</DropdownMenuItem>
                                <DropdownMenuItem>Mark as Delivered</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                 <CardContent>
                    <div className="space-y-1">
                        <p className="font-semibold">{order.customerName}</p>
                        <p className="text-sm text-muted-foreground">09035576078</p>
                        <p className="text-sm text-muted-foreground">Oko-awo Street (Building 5), VI opposite Eko hotel, Nigeria</p>
                    </div>
                     <div className="flex gap-1 mt-2">
                        <Button variant="outline" size="sm" className="gap-1 text-xs h-7">
                            <Edit className="h-3 w-3"/> Edit
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1 text-xs h-7">
                            <Copy className="h-3 w-3"/> Copy
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
