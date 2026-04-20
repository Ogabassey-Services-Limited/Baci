'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OgabasseyV2AddressBook } from '@/components/storefront/ogabassey/pages/address-book';
import { Button } from '@/components/ui/button';
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
import { normalizeSavedAddresses } from '@/lib/saved-addresses';

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
      full_name: customer
        ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
        : '',
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

    const newAddresses = normalizeSavedAddresses(
      addresses.filter((a) => a.id !== addressId)
    );
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
    const newAddresses = normalizeSavedAddresses(
      addresses.map((a) => ({
        ...a,
        is_default: a.id === addressId,
      }))
    );

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
      <div className="min-h-screen bg-gray-50">
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Link
            href={asRoute('/account')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to account</span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="w-full">
        <OgabasseyV2AddressBook
          addresses={addresses}
          onAdd={handleAddNew}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSetDefault={handleSetDefault}
        />
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
