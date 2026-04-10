'use client';

import {
  Check,
  Heart,
  Loader2,
  Package,
  Share2,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useCart } from '@/hooks/use-cart';
import { useCurrencyWithCountry } from '@/hooks/use-currency';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';
import type { Product } from '@/lib/products';

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
    category_id?: string | null;
    categories?: { id: string; name: string; slug: string } | null;
  };
}

interface WishListPageClientProps {
  merchantCountry: string | null;
}

export function WishListPageClient({
  merchantCountry,
}: WishListPageClientProps) {
  const params = useParams();
  const { toast } = useToast();
  const { addToCart } = useCart();
  const { customer, isAuthenticated } = useCustomerAuth();
  const merchantSlug = params.slug as string;

  const [customerEmail, setCustomerEmail] = useState('');
  const [isEmailSubmitted, setIsEmailSubmitted] = useState(false);
  const [wishListItems, setWishListItems] = useState<WishListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [movingToCartId, setMovingToCartId] = useState<string | null>(null);
  const [shareUrlCopied, setShareUrlCopied] = useState(false);

  // Use dynamic currency based on merchant's country (provided server-side)
  const { formatCurrency } = useCurrencyWithCountry(merchantCountry);

  // Check auth or localStorage and fetch wishlist
  useEffect(() => {
    const loadWishList = async (emailForLookup: string) => {
      if (!emailForLookup) return;
      setIsLoading(true);
      try {
        // The API route resolves identity via Supabase auth cookies.
        // For authenticated users, no extra params are needed.
        // Email is used only for local state display, not for API lookup.
        const response = await fetch('/api/wishlist');
        if (response.ok) {
          const data = await response.json();
          setWishListItems(data.items || []);
        } else {
          throw new Error('Failed to fetch wish list');
        }
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load your wish list.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated && customer?.email) {
      setCustomerEmail(customer.email);
      setIsEmailSubmitted(true);
      loadWishList(customer.email);
    } else {
      try {
        const storedEmail = localStorage.getItem('customerEmail');
        if (storedEmail) {
          setCustomerEmail(storedEmail);
          setIsEmailSubmitted(true);
          loadWishList(storedEmail);
        }
      } catch {
        // localStorage not available
      }
    }
  }, [isAuthenticated, customer?.email, toast]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmail.trim()) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address.',
        variant: 'destructive',
      });
      return;
    }

    // Store email in localStorage for display purposes
    localStorage.setItem('customerEmail', customerEmail);
    setIsEmailSubmitted(true);

    // Fetch wishlist - the API resolves identity via auth cookies
    setIsLoading(true);
    try {
      const response = await fetch('/api/wishlist');
      if (response.ok) {
        const data = await response.json();
        setWishListItems(data.items || []);
      } else {
        throw new Error('Failed to fetch wish list');
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load your wish list.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: string, productName: string) => {
    setRemovingItemId(itemId);
    try {
      const response = await fetchWithCsrf(`/api/wishlist?id=${itemId}`, {
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
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to remove item from wish list.',
        variant: 'destructive',
      });
    } finally {
      setRemovingItemId(null);
    }
  };

  const handleMoveToCart = async (item: WishListItem) => {
    setMovingToCartId(item.id);
    try {
      // Convert wishlist item to product format for cart
      // Use joined category data if available, fallback to TEXT column
      const categoryName =
        item.products.categories?.name || item.products.category || '';
      const categorySlug = item.products.categories?.slug;

      const product = {
        id: item.products.id,
        name: item.products.name,
        slug: item.products.slug,
        description: item.products.description,
        price: item.products.price,
        image: item.products.images?.[0] || '',
        imageLarge: item.products.images?.[0] || '',
        imageHint: item.products.name,
        stock:
          item.products.stock_quantity == null
            ? 9999
            : item.products.stock_quantity,
        category: categoryName,
        category_slug: categorySlug,
        status: item.products.status as 'active' | 'draft' | 'archived',
        manage_stock: item.products.stock_quantity != null,
        brand: '',
        gtin: '',
        mpn: '',
      } as Product;

      addToCart(product, 1);

      // Remove from wishlist
      const response = await fetchWithCsrf(`/api/wishlist?id=${item.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setWishListItems((prev) => prev.filter((i) => i.id !== item.id));
        toast({
          title: 'Added to Cart',
          description: `${item.products.name} has been added to your cart.`,
        });
      } else {
        toast({
          title: 'Partially Complete',
          description: `${item.products.name} added to cart but could not be removed from wishlist.`,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to move item to cart.',
        variant: 'destructive',
      });
    } finally {
      setMovingToCartId(null);
    }
  };

  const handleShareWishlist = async () => {
    // Generate a share token by creating a server-side shareable link
    // This avoids exposing email addresses in URLs which is a PII concern
    try {
      const response = await fetchWithCsrf('/api/wishlist/share', {
        method: 'POST',
        body: JSON.stringify({ email: customerEmail, merchantSlug }),
      });

      let shareUrl: string;
      if (response.ok) {
        const { token } = await response.json();
        shareUrl = `${window.location.origin}/${merchantSlug}/wishlist?share=${token}`;
      } else {
        // Fallback: Use a simple hash of email + timestamp for basic obfuscation
        // Note: This is not cryptographically secure but avoids plain email in URL
        const timestamp = Date.now().toString(36);
        const hash = await crypto.subtle
          .digest(
            'SHA-256',
            new TextEncoder().encode(customerEmail + timestamp)
          )
          .then((buf) =>
            Array.from(new Uint8Array(buf))
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('')
              .substring(0, 16)
          );
        shareUrl = `${window.location.origin}/${merchantSlug}/wishlist?ref=${hash}&t=${timestamp}`;
      }

      await navigator.clipboard.writeText(shareUrl);
      setShareUrlCopied(true);
      toast({
        title: 'Link Copied!',
        description: 'Share this link with friends and family.',
      });
      setTimeout(() => setShareUrlCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      toast({
        title: 'Unable to Share',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  if (!isEmailSubmitted) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md">
        <Card className="glass-themed">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <Heart
                className="mx-auto h-12 w-12 text-red-500 mb-4"
                aria-hidden="true"
              />
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
              {customerEmail} • {wishListItems.length} item
              {wishListItems.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            {wishListItems.length > 0 && (
              <Button variant="outline" onClick={handleShareWishlist}>
                {shareUrlCopied ? (
                  <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                ) : (
                  <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {shareUrlCopied ? 'Copied!' : 'Share'}
              </Button>
            )}
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
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2
            className="h-8 w-8 motion-safe:animate-spin"
            aria-hidden="true"
          />
          <span className="sr-only">Loading your wish list...</span>
        </div>
      ) : wishListItems.length === 0 ? (
        <Card className="glass-themed">
          <CardContent className="py-12">
            <div className="text-center">
              <Package
                className="mx-auto h-12 w-12 text-muted-foreground mb-4"
                aria-hidden="true"
              />
              <h3 className="text-lg font-semibold mb-2">
                Your wish list is empty
              </h3>
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
            <Card
              key={item.id}
              className="glass-themed overflow-hidden hover-lift"
            >
              <div className="relative aspect-square">
                {item.products.images && item.products.images.length > 0 ? (
                  <Image
                    src={item.products.images[0]}
                    alt={item.products.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Package
                      className="h-12 w-12 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                  {item.products.name}
                </h3>
                {(item.products.categories?.name || item.products.category) && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {item.products.categories?.name || item.products.category}
                  </p>
                )}
                <p className="text-2xl font-bold mb-4">
                  {formatCurrency(item.products.price)}
                </p>

                {item.products.status === 'active' ? (
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      onClick={() => handleMoveToCart(item)}
                      disabled={movingToCartId === item.id}
                    >
                      {movingToCartId === item.id ? (
                        <Loader2
                          className="mr-2 h-4 w-4 motion-safe:animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <ShoppingCart
                          className="mr-2 h-4 w-4"
                          aria-hidden="true"
                        />
                      )}
                      Move to Cart
                    </Button>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" className="flex-1">
                        <Link
                          href={`/${merchantSlug}/products/${item.products.slug}`}
                        >
                          View
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          handleRemoveItem(item.id, item.products.name)
                        }
                        disabled={removingItemId === item.id}
                        aria-label={`Remove ${item.products.name} from wishlist`}
                      >
                        {removingItemId === item.id ? (
                          <Loader2
                            className="h-4 w-4 motion-safe:animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-red-500 text-center">
                      Currently Unavailable
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        handleRemoveItem(item.id, item.products.name)
                      }
                      disabled={removingItemId === item.id}
                      aria-label={`Remove ${item.products.name} from wishlist`}
                    >
                      {removingItemId === item.id ? (
                        <Loader2
                          className="mr-2 h-4 w-4 motion-safe:animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
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
