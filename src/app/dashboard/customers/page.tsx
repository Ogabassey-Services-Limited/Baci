
'use client';

import { useState, useEffect } from 'react';
import {
    Search,
    Plus,
    Download,
    MoreVertical,
    Trash2,
    Edit,
    Loader2,
    BarChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useMerchant } from '@/hooks/use-merchant';
import { getCountryByCode } from '@/lib/countries';
import { apiGet, apiPost } from '@/lib/api-client';
import { useAuth } from '@/contexts/auth-context';
import { AddressAutocomplete } from '@/components/address-autocomplete';

interface Customer {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    total_orders: number;
    total_spent: number;
    store_credit: number;
    created_at: string;
}

export default function CustomersPage() {
    const { user, loading: authLoading } = useAuth();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const { toast } = useToast();
    const { merchant } = useMerchant();

    // Form state
    const [newCustomer, setNewCustomer] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        address: '',
    });

    useEffect(() => {
        const fetchCustomers = async () => {
            if (authLoading || !user) {
                return;
            }

            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (searchTerm) params.append('search', searchTerm);

                const data = await apiGet<{ customers: Customer[] }>(`/api/customers?${params.toString()}`);
                setCustomers(data.customers);
            } catch (error) {
                // Gracefully handle authorization errors that can happen during session loading
                if (!(error as Error).message.includes('Unauthorized')) {
                    toast({
                        title: 'Error',
                        description: 'Failed to load customers',
                        variant: 'destructive',
                    });
                }
            } finally {
                setLoading(false);
            }
        };

        fetchCustomers();
    }, [searchTerm, authLoading, user, toast]);

    const handleAddCustomer = async () => {
        try {
            // apiPost will throw an error if the request fails
            await apiPost('/api/customers', newCustomer);

            toast({
                title: 'Success',
                description: 'Customer created successfully',
            });
            setIsAddOpen(false);
            setNewCustomer({ first_name: '', last_name: '', email: '', phone: '', address: '' });

            // Refetch customers after adding to show the new customer
            const data = await apiGet<{ customers: Customer[] }>(`/api/customers`);
            setCustomers(data.customers);

        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to create customer',
                variant: 'destructive',
            });
        }
    };

    const formatCurrency = (amount: number) => {
        const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
        const locale = country ? `en-${country.code}` : 'en-US';
        const currency = country ? country.currency : 'NGN';

        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
        }).format(amount);
    };

    if (authLoading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Customers</h1>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/10">
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                    <Button variant="outline" size="sm" asChild className="border-primary text-primary hover:bg-primary/10">
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
                                        onChange={(e) => setNewCustomer({ ...newCustomer, first_name: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="last_name">Last Name</Label>
                                    <Input
                                        id="last_name"
                                        value={newCustomer.last_name}
                                        onChange={(e) => setNewCustomer({ ...newCustomer, last_name: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={newCustomer.email}
                                        onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <PhoneInput
                                        id="phone"
                                        value={newCustomer.phone}
                                        onChange={(value) => setNewCustomer({ ...newCustomer, phone: value })}
                                        defaultCountry="NG"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="address">Address</Label>
                                    <AddressAutocomplete
                                        id="address"
                                        value={newCustomer.address}
                                        onChange={(val: string | React.ChangeEvent<HTMLInputElement>) => {
                                            const value = typeof val === 'string' ? val : val.target.value;
                                            setNewCustomer({ ...newCustomer, address: value });
                                        }}
                                        onSelect={(place: Record<string, unknown>) => {
                                            setNewCustomer({ ...newCustomer, address: place.formattedAddress as string });
                                        }}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
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
                    />
                </div>
            </div>

            <div className="border border-primary/20 rounded-md bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
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
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : customers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                    No customers found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            customers.map((customer) => (
                                <TableRow key={customer.id}>
                                    <TableCell>
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback>
                                                {customer.first_name && customer.first_name.length > 0
                                                    ? customer.first_name.substring(0, 1).toUpperCase()
                                                    : "?"}
                                                {customer.last_name && customer.last_name.length > 0
                                                    ? customer.last_name.substring(0, 1).toUpperCase()
                                                    : ""}
                                            </AvatarFallback>
                                        </Avatar>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <Link href={`/dashboard/customers/${customer.id}`} className="hover:underline">
                                            {customer.first_name} {customer.last_name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{customer.email || '-'}</TableCell>
                                    <TableCell>{customer.phone || '-'}</TableCell>
                                    <TableCell>{customer.total_orders}</TableCell>
                                    <TableCell>{formatCurrency(customer.total_spent)}</TableCell>
                                    <TableCell>
                                        {customer.store_credit > 0 ? (
                                            <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
                                                {formatCurrency(customer.store_credit)}
                                            </Badge>
                                        ) : (
                                            '-'
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
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
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
