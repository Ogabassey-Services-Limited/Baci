'use client';

import { getCustomerDisplayName } from '@baci/shared';
import {
  BarChart,
  Download,
  Edit,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  AddressAutocomplete,
  type PlaceDetails,
} from '@/components/address-autocomplete';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/auth-context';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import { getCountryByCode } from '@/lib/countries';
import {
  type CreateCustomerData,
  type Customer,
  createCustomer,
  getCustomers,
} from './actions';

interface CustomersClientPageProps {
  initialCustomers?: Customer[];
}

export default function CustomersClientPage({
  initialCustomers = [],
}: CustomersClientPageProps) {
  const { user, loading: authLoading } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();
  const { merchant } = useMerchant();

  // Track first render/hydration
  const isHydrated = useRef(false);

  // Form state
  const [newCustomer, setNewCustomer] = useState<CreateCustomerData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    // Skip initial fetch if we have hydration data and no search term
    if (!isHydrated.current && initialCustomers.length > 0 && !searchTerm) {
      isHydrated.current = true;
      return;
    }
    isHydrated.current = true;

    if (authLoading || !user || !merchant?.id) {
      return;
    }

    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const data = await getCustomers(merchant.id, searchTerm);
        setCustomers(data);
      } catch (_error) {
        toast({
          title: 'Error',
          description: 'Failed to load customers',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timer = setTimeout(
      () => {
        fetchCustomers();
      },
      searchTerm ? 500 : 0
    );

    return () => clearTimeout(timer);
  }, [searchTerm, authLoading, user, merchant?.id, toast, initialCustomers]);

  const handleAddCustomer = async () => {
    try {
      if (!merchant?.id) return;

      await createCustomer(newCustomer);

      toast({
        title: 'Success',
        description: 'Customer created successfully',
      });
      setIsAddOpen(false);
      setNewCustomer({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        address: '',
      });

      // Refetch customers to show the new one
      const data = await getCustomers(merchant.id, searchTerm);
      setCustomers(data);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create customer',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (amount: number) => {
    const country = merchant?.country
      ? getCountryByCode(merchant.country)
      : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'NGN';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 motion-safe:animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
          Customers 👥
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-primary text-primary hover:bg-primary/10"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="border-primary text-primary hover:bg-primary/10"
          >
            <Link href="/dashboard/analytics?category=customers">
              <BarChart className="mr-2 h-4 w-4 text-primary" />
              Customer Analytics
            </Link>
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add New Customer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={newCustomer.first_name}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        first_name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={newCustomer.last_name}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        last_name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, email: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <PhoneInput
                    id="phone"
                    value={newCustomer.phone}
                    onChange={(value) =>
                      setNewCustomer({ ...newCustomer, phone: value })
                    }
                    defaultCountry="NG"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Address</Label>
                  <AddressAutocomplete
                    value={newCustomer.address}
                    onChange={(val) => {
                      const value =
                        typeof val === 'string' ? val : val.target.value;
                      setNewCustomer({ ...newCustomer, address: value });
                    }}
                    onSelect={(place: PlaceDetails) => {
                      setNewCustomer({
                        ...newCustomer,
                        address: place.formattedAddress,
                      });
                    }}
                    placeholder="Enter customer address"
                    showIcon={true}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCustomer}>Save Customer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-primary" />
          <Input
            placeholder="Search customers..."
            className="pl-8 border-primary/50 focus-visible:ring-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search customers"
          />
        </div>
      </div>

      <div className="glass border border-primary/20 rounded-md bg-white/50 dark:bg-card/30">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]" />
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Total Spent</TableHead>
              <TableHead>Store Credit</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 motion-safe:animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => {
                const displayName = getCustomerDisplayName(customer);
                const initials =
                  displayName
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() ?? '')
                    .join('') || '?';

                return (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className="hover:underline"
                        aria-label={`View details for ${displayName}`}
                      >
                        {displayName}
                      </Link>
                    </TableCell>
                    <TableCell>{customer.email || '-'}</TableCell>
                    <TableCell>{customer.phone || '-'}</TableCell>
                    <TableCell>{customer.total_orders}</TableCell>
                    <TableCell>
                      {formatCurrency(customer.total_spent)}
                    </TableCell>
                    <TableCell>
                      {customer.store_credit > 0 ? (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-300 dark:hover:bg-green-900/40"
                        >
                          {formatCurrency(customer.store_credit)}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Actions for ${displayName}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Link href={`/dashboard/customers/${customer.id}`}>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              View Profile
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
