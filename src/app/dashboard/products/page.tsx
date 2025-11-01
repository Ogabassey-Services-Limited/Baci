
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { File, MoreHorizontal, PlusCircle, Save } from 'lucide-react';
import { useMerchant } from '@/hooks/use-merchant';
import { getCountryByCode } from '@/lib/countries';
import { products as initialProducts, type Product } from '@/lib/products';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

export default function ProductsPage() {
  const { merchant } = useMerchant();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [isSaving, setIsSaving] = useState(false);

  const formatCurrency = (amount: number) => {
    const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleStockChange = (productId: string, newStock: number) => {
    setProducts(currentProducts =>
      currentProducts.map(p =>
        p.id === productId ? { ...p, stock: isNaN(newStock) ? 0 : newStock } : p
      )
    );
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    // In a real app, you'd send this to your backend
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Saved product stock:', products.map(p => ({id: p.id, stock: p.stock})));
    setIsSaving(false);
    toast({
      title: 'Stock quantities saved!',
      description: 'Your inventory has been updated.',
    });
  };

  return (
    <Tabs defaultValue="all">
      <div className="flex items-center">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="archived" className="hidden sm:flex">
            Archived
          </TabsTrigger>
        </TabsList>
        <div className="ml-auto flex items-center gap-2">
           <Button size="sm" variant="outline" className="h-8 gap-1" onClick={handleSave} disabled={isSaving}>
              <Save className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                {isSaving ? 'Saving...' : 'Save Stock'}
              </span>
            </Button>
           <a href="/api/products/feed" target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-8 gap-1">
              <File className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Export Feed
              </span>
            </Button>
          </a>
          <Link href="/dashboard/products/add">
            <Button size="sm" className="h-8 gap-1">
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Add Product
              </span>
            </Button>
          </Link>
        </div>
      </div>
      <TabsContent value="all">
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
            <CardDescription>
              Manage your products and view their sales performance. You can edit stock directly here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden w-[100px] sm:table-cell">
                    <span className="sr-only">Image</span>
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="w-[120px]">
                    In Stock
                  </TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="hidden sm:table-cell">
                    <Image
                      alt="Product image"
                      className="aspect-square rounded-md object-cover"
                      height="64"
                      src={product.image}
                      width="64"
                      data-ai-hint={product.imageHint}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <Badge variant={product.status === 'active' ? 'default' : 'outline'}>{product.status}</Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(product.price)}</TableCell>
                  <TableCell>
                    <Input
                        type="number"
                        className="h-8 w-20"
                        value={product.stock}
                        onChange={(e) => handleStockChange(product.id, parseInt(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-haspopup="true"
                          size="icon"
                          variant="ghost"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Duplicate</DropdownMenuItem>
                        <DropdownMenuItem className='text-red-600'>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter>
            <div className="text-xs text-muted-foreground">
              Showing <strong>1-5</strong> of <strong>{products.length}</strong> products
            </div>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
