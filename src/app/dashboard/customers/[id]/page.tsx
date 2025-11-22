'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Edit,
    Trash2,
    Phone,
    Mail,
    MapPin,
    CreditCard,
    Loader2,
    ShoppingBag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface Customer {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string;
    total_orders: number;
    total_spent: number;
    store_credit: number;
    created_at: string;
}

export default function CustomerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [creditAmount, setCreditAmount] = useState('');
    const [isCreditOpen, setIsCreditOpen] = useState(false);

    useEffect(() => {
        const fetchCustomer = async () => {
            try {
                const res = await fetch(`/api/customers/${params.id}`);
                if (!res.ok) throw new Error('Failed to fetch customer');
                const data = await res.json();
                setCustomer(data.customer);
            } catch (error) {
                console.error(error);
                toast({
                    title: 'Error',
                    description: 'Failed to load customer details',
                    variant: 'destructive',
                });
            } finally {
                setLoading(false);
            }
        };

        if (params.id) {
            fetchCustomer();
        }
    }, [params.id]);

    const handleUpdateCredit = async () => {
        if (!customer) return;
        try {
            const newCredit = parseFloat(creditAmount);
            if (isNaN(newCredit)) return;

            const res = await fetch(`/api/customers/${customer.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_credit: newCredit }),
            });

            if (!res.ok) throw new Error('Failed to update credit');

            const data = await res.json();
            setCustomer(data.customer);
            setIsCreditOpen(false);
            toast({
                title: 'Success',
                description: 'Store credit updated',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to update store credit',
                variant: 'destructive',
            });
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this customer?')) return;
        try {
            const res = await fetch(`/api/customers/${params.id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete customer');
            toast({
                title: 'Success',
                description: 'Customer deleted',
            });
            router.push('/dashboard/customers');
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete customer',
                variant: 'destructive',
            });
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
        }).format(amount);
    };

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!customer) {
        return <div>Customer not found</div>;
    }

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
                    <Button variant="outline" onClick={() => { }}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Profile
                    </Button>
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
                                <AvatarFallback className="text-2xl">{customer.first_name.substring(0, 1).toUpperCase()}{customer.last_name.substring(0, 1).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold">{customer.first_name} {customer.last_name}</h2>
                                <p className="text-muted-foreground">Customer since: {new Date(customer.created_at).toLocaleDateString()}</p>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Last Order</p>
                                        <p className="font-medium">N/A</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Total Spent</p>
                                        <p className="font-medium">{formatCurrency(customer.total_spent)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Total Orders</p>
                                        <p className="font-medium">{customer.total_orders}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Store Credit</p>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-green-600">{formatCurrency(customer.store_credit)}</p>
                                            <Dialog open={isCreditOpen} onOpenChange={setIsCreditOpen}>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-4 w-4 ml-1">
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
                                                                onChange={(e) => setCreditAmount(e.target.value)}
                                                                placeholder="Enter new balance"
                                                            />
                                                        </div>
                                                    </div>
                                                    <DialogFooter>
                                                        <Button onClick={handleUpdateCredit}>Update Balance</Button>
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

            {/* Purchase History - Placeholder for now as we don't have linked orders yet */}
            <Card>
                <CardHeader>
                    <CardTitle>Purchase History</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>No orders found for this customer.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
