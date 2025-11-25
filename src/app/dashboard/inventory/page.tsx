
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package, AlertTriangle, ArrowUpDown, Save, Loader2 } from 'lucide-react';
import { useMerchant } from '@/hooks/use-merchant';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

interface InventoryItem {
    id: string;
    name: string;
    sku: string | null;
    stock_quantity: number;
    low_stock_threshold: number;
    manage_stock: boolean;
    image_small: string | null;
    variants?: {
        id: string;
        attributes: Record<string, string>;
        stock_quantity: number;
        sku: string | null;
    }[];
}

export default function InventoryPage() {
    const { merchant } = useMerchant();
    const { toast } = useToast();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState<string | null>(null);

    useEffect(() => {
        if (merchant) {
            fetchInventory();
        }
    }, [merchant]);

    const fetchInventory = async () => {
        setLoading(true);
        const supabase = createClient();

        // Fetch products with variants
        const { data: products, error } = await supabase
            .from('products')
            .select(`
        id, 
        name, 
        sku, 
        stock_quantity, 
        low_stock_threshold, 
        manage_stock, 
        image_small,
        variants:product_variants(id, attributes, stock_quantity, sku)
      `)
            .eq('merchant_id', merchant!.id)
            .order('name');

        if (error) {
            console.error('Error fetching inventory:', error);
            toast({
                title: 'Error',
                description: 'Failed to load inventory.',
                variant: 'destructive',
            });
        } else {
            setItems(products || []);
        }
        setLoading(false);
    };

    const updateStock = async (id: string, newStock: number, isVariant: boolean = false) => {
        setSaving(id);
        const supabase = createClient();
        const table = isVariant ? 'product_variants' : 'products';

        const { error } = await supabase
            .from(table)
            .update({ stock_quantity: newStock })
            .eq('id', id);

        if (error) {
            toast({
                title: 'Error',
                description: 'Failed to update stock.',
                variant: 'destructive',
            });
        } else {
            // Update local state
            setItems(prev => prev.map(item => {
                if (!isVariant && item.id === id) {
                    return { ...item, stock_quantity: newStock };
                }
                if (item.variants) {
                    return {
                        ...item,
                        variants: item.variants.map(v =>
                            v.id === id ? { ...v, stock_quantity: newStock } : v
                        )
                    };
                }
                return item;
            }));

            toast({
                title: 'Success',
                description: 'Stock updated.',
            });
        }
        setSaving(null);
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const lowStockCount = items.reduce((acc, item) => {
        let count = 0;
        if (item.manage_stock && item.stock_quantity <= (item.low_stock_threshold || 5)) count++;
        item.variants?.forEach(v => {
            // Assuming variants use parent threshold for now, or default 5
            if (v.stock_quantity <= (item.low_stock_threshold || 5)) count++;
        });
        return acc + count;
    }, 0);

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Inventory Management</h1>
                <Button onClick={fetchInventory} variant="outline" size="sm">
                    Refresh
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{items.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{lowStockCount}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name or SKU..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>Stock Level</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No products found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map((item) => (
                                    <React.Fragment key={item.id}>
                                        <TableRow className={item.variants && item.variants.length > 0 ? "bg-muted/30" : ""}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {item.image_small && (
                                                        <img src={item.image_small} alt="" className="w-8 h-8 rounded object-cover" />
                                                    )}
                                                    {item.name}
                                                </div>
                                            </TableCell>
                                            <TableCell>{item.sku || '-'}</TableCell>
                                            <TableCell>
                                                {item.manage_stock && (!item.variants || item.variants.length === 0) ? (
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            className="w-20 h-8"
                                                            defaultValue={item.stock_quantity}
                                                            onBlur={(e) => {
                                                                const val = parseInt(e.target.value);
                                                                if (!isNaN(val) && val !== item.stock_quantity) {
                                                                    updateStock(item.id, val, false);
                                                                }
                                                            }}
                                                        />
                                                        {saving === item.id && <Loader2 className="h-3 w-3 animate-spin" />}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">
                                                        {item.variants && item.variants.length > 0 ? 'See variants below' : 'Not tracked'}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {item.manage_stock && item.stock_quantity <= (item.low_stock_threshold || 5) && (!item.variants || item.variants.length === 0) && (
                                                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Low Stock</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {/* Actions like View History could go here */}
                                            </TableCell>
                                        </TableRow>
                                        {item.variants?.map(variant => (
                                            <TableRow key={variant.id} className="bg-muted/10">
                                                <TableCell className="pl-10 text-sm text-muted-foreground">
                                                    ↳ {Object.values(variant.attributes).join(' / ')}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{variant.sku || '-'}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            className="w-20 h-8"
                                                            defaultValue={variant.stock_quantity}
                                                            onBlur={(e) => {
                                                                const val = parseInt(e.target.value);
                                                                if (!isNaN(val) && val !== variant.stock_quantity) {
                                                                    updateStock(variant.id, val, true);
                                                                }
                                                            }}
                                                        />
                                                        {saving === variant.id && <Loader2 className="h-3 w-3 animate-spin" />}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {variant.stock_quantity <= (item.low_stock_threshold || 5) && (
                                                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs">Low Stock</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell></TableCell>
                                            </TableRow>
                                        ))}
                                    </React.Fragment>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
