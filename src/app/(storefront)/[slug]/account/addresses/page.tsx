'use client';

import {
  ArrowLeft,
  Edit2,
  Loader2,
  MapPin,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type SavedAddress,
  useCustomerAuth,
} from '@/contexts/customer-auth-context';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { asRoute } from '@/lib/routes';

const emptyAddress: Omit<SavedAddress, 'id'> = {
  label: '',
  full_name: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  country: '',
  postal_code: '',
  is_default: false,
};

export default function CustomerAddressesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { merchant, loading: merchantLoading } = useMerchant();
  const {
    customer,
    isAuthenticated,
    isLoading: authLoading,
    updateCustomer,
  } = useCustomerAuth();

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(
    null
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] =
    useState<Omit<SavedAddress, 'id'>>(emptyAddress);

  // Initialize addresses from customer data
  useEffect(() => {
    if (customer?.saved_addresses) {
      setAddresses(customer.saved_addresses);
    }
  }, [customer?.saved_addresses]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(asRoute('/account/login?redirect=/account/addresses'));
    }
  }, [authLoading, isAuthenticated, router]);

  const handleAddNew = () => {
    setEditingAddress(null);
    setFormData({
      ...emptyAddress,
      full_name: customer?.full_name || '',
      phone: customer?.phone || '',
      country: merchant?.country || '',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (address: SavedAddress) => {
    setEditingAddress(address);
    setFormData({
      label: address.label,
      full_name: address.full_name,
      phone: address.phone,
      address: address.address,
      city: address.city,
      state: address.state,
      country: address.country,
      postal_code: address.postal_code || '',
      is_default: address.is_default || false,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (addressId: string) => {
    // Confirm deletion with user before proceeding
    if (
      !window.confirm(
        'Are you sure you want to delete this address? This action cannot be undone.'
      )
    ) {
      return;
    }

    const newAddresses = addresses.filter((a) => a.id !== addressId);
    try {
      const result = await updateCustomer({ saved_addresses: newAddresses });

      if (result.success) {
        setAddresses(newAddresses);
        toast({
          title: 'Address deleted',
          description: 'The address has been removed from your account.',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete address',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSetDefault = async (addressId: string) => {
    const newAddresses = addresses.map((a) => ({
      ...a,
      is_default: a.id === addressId,
    }));
    const result = await updateCustomer({ saved_addresses: newAddresses });

    if (result.success) {
      setAddresses(newAddresses);
      toast({
        title: 'Default address updated',
        description: 'This address will be pre-selected at checkout.',
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    let newAddresses: SavedAddress[];

    if (editingAddress) {
      // Update existing
      newAddresses = addresses.map((a) =>
        a.id === editingAddress.id ? { ...formData, id: editingAddress.id } : a
      );
    } else {
      // Add new
      const newAddress: SavedAddress = {
        ...formData,
        id: `addr_${Date.now()}`,
      };

      // If this is the first address, make it default
      if (addresses.length === 0) {
        newAddress.is_default = true;
      }

      newAddresses = [...addresses, newAddress];
    }

    // If new address is default, unset others
    if (formData.is_default) {
      newAddresses = newAddresses.map((a) => ({
        ...a,
        is_default:
          a.id ===
          (editingAddress?.id || newAddresses[newAddresses.length - 1].id),
      }));
    }

    const result = await updateCustomer({ saved_addresses: newAddresses });

    if (result.success) {
      setAddresses(newAddresses);
      setIsDialogOpen(false);
      toast({
        title: editingAddress ? 'Address updated' : 'Address added',
        description: editingAddress
          ? 'Your address has been updated.'
          : 'New address has been added to your account.',
      });
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to save address',
        variant: 'destructive',
      });
    }

    setIsSaving(false);
  };

  if (merchantLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !customer) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Link
            href={asRoute('/account')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to account</span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-2">Saved Addresses</h1>
            <p className="text-muted-foreground">
              Manage your shipping addresses
            </p>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Address
          </Button>
        </div>

        {addresses.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <MapPin className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">No saved addresses</h3>
              <p className="text-muted-foreground mb-6">
                Add an address to speed up checkout
              </p>
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Address
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {addresses.map((address) => (
              <Card
                key={address.id}
                className={address.is_default ? 'border-primary' : ''}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">
                        {address.label || 'Address'}
                      </CardTitle>
                      {address.is_default && (
                        <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          <Star className="h-3 w-3 fill-current" />
                          Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(address)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(address.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1">
                    <p className="font-medium">{address.full_name}</p>
                    <p className="text-muted-foreground">{address.address}</p>
                    <p className="text-muted-foreground">
                      {address.city}, {address.state} {address.postal_code}
                    </p>
                    <p className="text-muted-foreground">{address.country}</p>
                    <p className="text-muted-foreground">{address.phone}</p>
                  </div>
                  {!address.is_default && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-2 h-auto p-0"
                      onClick={() => handleSetDefault(address.id)}
                    >
                      Set as default
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? 'Edit Address' : 'Add New Address'}
            </DialogTitle>
            <DialogDescription>
              {editingAddress
                ? 'Update your shipping address details'
                : 'Enter your shipping address details'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                placeholder="e.g., Home, Office"
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                placeholder="John Doe"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                placeholder="123 Main Street, Apt 4"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="New York"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="state">State/Province</Label>
                <Input
                  id="state"
                  placeholder="NY"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  placeholder="10001"
                  value={formData.postal_code}
                  onChange={(e) =>
                    setFormData({ ...formData, postal_code: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="United States"
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={formData.is_default}
                onChange={(e) =>
                  setFormData({ ...formData, is_default: e.target.checked })
                }
              />
              <span className="text-sm">Set as default shipping address</span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Address'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
