'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Heart, Trash2, ShoppingCart, Loader2, Package } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

interface WishListItem {
  id: string;
  created_at: string;
  product_id: string;
  products: {
    id: string;
    name: string;
    slug: string;
    description: string;
    price: number;
    images: string[];
    stock_quantity: number | null;
    status: string;
    category: string | null;
  };
}

export default function WishListPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const merchantSlug = params.slug as string;

  const [customerEmail, setCustomerEmail] = useState('');
  const [isEmailSubmitted, setIsEmailSubmitted] = useState(false);
  const [wishListItems, setWishListItems] = useState<WishListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);

  // Check if email is stored in localStorage
  useEffect(() => {
    const storedEmail = localStorage.getItem('customerEmail');
    if (storedEmail) {
      setCustomerEmail(storedEmail);
      setIsEmailSubmitted(true);
      fetchWishList(storedEmail);
    }
  }, []);

  const fetchWishList = async (email: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/wishlist?email=${encodeURIComponent(email)}`);
      if (response.ok) {
        const data = await response.json();
        setWishListItems(data.items || []);
      } else {
        throw new Error('Failed to fetch wish list');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load your wish list.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmail.trim()) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address.',
        variant: 'destructive',
      });
      return;
    }

    // Store email in localStorage
    localStorage.setItem('customerEmail', customerEmail);
    setIsEmailSubmitted(true);
    fetchWishList(customerEmail);
  };

  const handleRemoveItem = async (itemId: string, productName: string) => {
    setRemovingItemId(itemId);
    try {
      const response = await fetch(`/api/wishlist?id=${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove item');
      }

      setWishListItems((prev) => prev.filter((item) => item.id !== itemId));
      toast({
        title: 'Removed',
        description: `${productName} has been removed from your wish list.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove item from wish list.',
        variant: 'destructive',
      });
    } finally {
      setRemovingItemId(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  if (!isEmailSubmitted) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <Heart className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h1 className="text-2xl font-bold mb-2">Your Wish List</h1>
              <p className="text-muted-foreground">
                Enter your email to view and manage your saved items.
              </p>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                View My Wish List
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Your Wish List</h1>
            <p className="text-muted-foreground">
              {customerEmail} • {wishListItems.length} item{wishListItems.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              localStorage.removeItem('customerEmail');
              setIsEmailSubmitted(false);
              setWishListItems([]);
            }}
          >
            Change Email
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : wishListItems.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Your wish list is empty</h3>
              <p className="text-muted-foreground mb-6">
                Start adding items you love to save them for later!
              </p>
              <Button asChild>
                <Link href={`/${merchantSlug}`}>Browse Products</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {wishListItems.map((item) => (
            <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative aspect-square">
                {item.products.images && item.products.images.length > 0 ? (
                  <Image
                    src={item.products.images[0]}
                    alt={item.products.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Package className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                  {item.products.name}
                </h3>
                {item.products.category && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {item.products.category}
                  </p>
                )}
                <p className="text-2xl font-bold mb-4">
                  {formatPrice(item.products.price)}
                </p>

                {item.products.status === 'active' ? (
                  <div className="space-y-2">
                    <Button asChild className="w-full">
                      <Link href={`/${merchantSlug}/products/${item.products.slug}`}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        View Product
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleRemoveItem(item.id, item.products.name)}
                      disabled={removingItemId === item.id}
                    >
                      {removingItemId === item.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-red-500 text-center">
                      Currently Unavailable
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleRemoveItem(item.id, item.products.name)}
                      disabled={removingItemId === item.id}
                    >
                      {removingItemId === item.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Remove
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
