'use client';

import { getCustomerDisplayName, splitCustomerFullName } from '@baci/shared';
import {
  ArrowLeft,
  Edit,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  AddressAutocomplete,
  type PlaceDetails,
} from '@/components/address-autocomplete';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { useToast } from '@/hooks/use-toast';
import { apiDelete, apiPatch } from '@/lib/api-client';
import type { Customer, CustomerOrder } from '../actions';

interface CustomerDetailClientPageProps {
  initialCustomer: Customer;
  initialOrders: CustomerOrder[];
}

type EditableCustomerData = Pick<
  Customer,
  | 'address'
  | 'email'
  | 'first_name'
  | 'full_name'
  | 'last_name'
  | 'phone'
  | 'store_credit'
>;

function toEditableCustomerData(customer: Customer): EditableCustomerData {
  const initialNameFields = splitCustomerFullName(customer.full_name);

  return {
    first_name: customer.first_name ?? initialNameFields.first_name,
    last_name: customer.last_name ?? initialNameFields.last_name,
    full_name: customer.full_name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    store_credit: customer.store_credit,
  };
}

export default function CustomerDetailClientPage({
  initialCustomer,
  initialOrders,
}: CustomerDetailClientPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<Customer>(initialCustomer);
  const [orders] = useState<CustomerOrder[]>(initialOrders);

  // Loading states are no longer needed for initial load, but maybe for mutations?
  // We can keep simple state for mutations.

  const [creditAmount, setCreditAmount] = useState('');
  const [isCreditOpen, setIsCreditOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<EditableCustomerData>(
    toEditableCustomerData(initialCustomer)
  );

  const handleUpdateCredit = async () => {
    if (!customer) return;
    try {
      const newCredit = Number.parseFloat(creditAmount);
      if (Number.isNaN(newCredit)) return;

      const data = await apiPatch<{ customer: Customer }>(
        `/api/customers/${customer.id}`,
        { store_credit: newCredit }
      );
      setCustomer(data.customer);
      setIsCreditOpen(false);
      toast({
        title: 'Success',
        description: 'Store credit updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update store credit',
        variant: 'destructive',
      });
    }
  };

  const handleSaveChanges = async () => {
    if (!customer) return;
    try {
      const data = await apiPatch<{ customer: Customer }>(
        `/api/customers/${customer.id}`,
        editData
      );
      setCustomer(data.customer);
      setEditData(toEditableCustomerData(data.customer));
      setEditOpen(false);
      toast({
        title: 'Success',
        description: 'Customer profile updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    try {
      await apiDelete(`/api/customers/${customer.id}`);
      toast({
        title: 'Success',
        description: 'Customer deleted',
      });
      router.push('/dashboard/customers');
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete customer',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (
    amount: number,
    locale?: string,
    currency?: string
  ) => {
    // Fallback to browser locale and NGN if not specified
    const userLocale =
      locale ||
      (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
    const userCurrency = currency || 'NGN';
    return new Intl.NumberFormat(userLocale, {
      style: 'currency',
      currency: userCurrency,
    }).format(amount);
  };

  if (!customer) {
    return <div>Customer not found</div>;
  }

  const displayName = getCustomerDisplayName(customer);
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?';

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/customers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Customer Profile</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Profile</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={editData.first_name || ''}
                    onChange={(e) =>
                      setEditData({ ...editData, first_name: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={editData.last_name || ''}
                    onChange={(e) =>
                      setEditData({ ...editData, last_name: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editData.email || ''}
                    onChange={(e) =>
                      setEditData({ ...editData, email: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <PhoneInput
                    id="phone"
                    value={editData.phone || ''}
                    onChange={(value) =>
                      setEditData({ ...editData, phone: value })
                    }
                    defaultCountry="NG"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Address</Label>
                  <AddressAutocomplete
                    value={editData.address || ''}
                    onChange={(val) => {
                      const value =
                        typeof val === 'string' ? val : val.target.value;
                      setEditData({ ...editData, address: value });
                    }}
                    onSelect={(place: PlaceDetails) => {
                      setEditData({
                        ...editData,
                        address: place.formattedAddress,
                      });
                    }}
                    placeholder="Enter customer address"
                    showIcon={true}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveChanges}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="destructive" size="icon" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Profile Card */}
        <Card className="md:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{displayName}</h2>
                <p className="text-muted-foreground">
                  Customer since:{' '}
                  {new Date(customer.created_at).toLocaleDateString()}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">
                      Last Order
                    </p>
                    <p className="font-medium">N/A</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">
                      Total Spent
                    </p>
                    <p className="font-medium">
                      {formatCurrency(customer.total_spent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">
                      Total Orders
                    </p>
                    <p className="font-medium">{customer.total_orders}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">
                      Store Credit
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-green-600">
                        {formatCurrency(customer.store_credit)}
                      </p>
                      <Dialog
                        open={isCreditOpen}
                        onOpenChange={setIsCreditOpen}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 ml-1"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Update Store Credit</DialogTitle>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="credit">Credit Amount</Label>
                              <Input
                                id="credit"
                                type="number"
                                value={creditAmount}
                                onChange={(e) =>
                                  setCreditAmount(e.target.value)
                                }
                                placeholder="Enter new balance"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleUpdateCredit}>
                              Update Balance
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Details */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{customer.phone || 'No phone number'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{customer.email || 'No email'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Address</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                <span>{customer.address || 'No address provided'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Purchase History */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase History</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No orders found for this customer.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">
                          Order #{order.order_number}
                        </h3>
                        <Badge
                          variant={
                            order.shipping_status === 'delivered'
                              ? 'default'
                              : order.shipping_status === 'shipped'
                                ? 'secondary'
                                : order.shipping_status === 'processing'
                                  ? 'outline'
                                  : 'destructive'
                          }
                        >
                          {order.shipping_status || 'pending'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Date</p>
                          <p className="font-medium">
                            {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-medium">
                            {formatCurrency(order.total)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Items</p>
                          <p className="font-medium">
                            {order.items?.length || 0} items
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Payment</p>
                          <p className="font-medium capitalize">
                            {order.payment_method || 'N/A'}
                          </p>
                        </div>
                      </div>
                      {order.shipping_address && (
                        <div className="mt-3 text-sm">
                          <p className="text-muted-foreground">
                            Shipping Address
                          </p>
                          <p className="text-sm">{order.shipping_address}</p>
                        </div>
                      )}
                    </div>
                    <Link href={`/dashboard/orders/${order.id}`}>
                      <Button variant="ghost" size="sm">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
