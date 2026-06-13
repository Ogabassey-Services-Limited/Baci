'use client';

import {
  AlertCircle,
  CreditCard,
  FileText,
  Palette,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

// Default free shipping threshold value
const DEFAULT_FREE_SHIPPING_THRESHOLD = 50;

// Allowed layouts for product page
const PRODUCT_PAGE_LAYOUTS = ['standard', 'wide', 'sidebar'] as const;
type ProductPageLayout = (typeof PRODUCT_PAGE_LAYOUTS)[number];

// Allowed image gallery styles
const IMAGE_GALLERY_STYLES = ['thumbnails', 'dots', 'slider'] as const;
type ImageGalleryStyle = (typeof IMAGE_GALLERY_STYLES)[number];

/**
 * Validates the free shipping threshold value.
 * Returns the value if it's a number >= 0, otherwise returns the default.
 */
function validateFreeShippingThreshold(value: unknown): number {
  const num = Number(value);
  return !Number.isNaN(num) && num >= 0 ? num : DEFAULT_FREE_SHIPPING_THRESHOLD;
}

export interface StoreSettings {
  // Product Page Settings
  productPage: {
    layout: 'standard' | 'wide' | 'sidebar';
    showRelatedProducts: boolean;
    showReviews: boolean;
    showShareButtons: boolean;
    imageGalleryStyle: 'thumbnails' | 'dots' | 'slider';
    enableZoom: boolean;
    showInventory: boolean;
  };
  // Cart Settings
  cart: {
    enableCartDrawer: boolean;
    showShippingEstimate: boolean;
    showProgressBar: boolean;
    freeShippingThreshold?: number;
    enableGiftMessage: boolean;
    enableDiscountCodes: boolean;
  };
  // Checkout Settings
  checkout: {
    enableGuestCheckout: boolean;
    requirePhoneNumber: boolean;
    showOrderNotes: boolean;
    showNewsletterSignup: boolean;
    enableExpressCheckout: boolean;
  };
  // Shipping Settings
  shipping: {
    showEstimatedDelivery: boolean;
    defaultShippingMessage: string;
    internationalShipping: boolean;
  };
  // Policies
  policies: {
    returnPolicy?: string;
    shippingPolicy?: string;
    privacyPolicy?: string;
  };
}

interface StoreSettingsPanelProps {
  settings: StoreSettings;
  onChange: (settings: StoreSettings) => void;
}

const defaultSettings: StoreSettings = {
  productPage: {
    layout: 'standard',
    showRelatedProducts: true,
    showReviews: true,
    showShareButtons: true,
    imageGalleryStyle: 'thumbnails',
    enableZoom: true,
    showInventory: true,
  },
  cart: {
    enableCartDrawer: true,
    showShippingEstimate: true,
    showProgressBar: false,
    freeShippingThreshold: DEFAULT_FREE_SHIPPING_THRESHOLD,
    enableGiftMessage: false,
    enableDiscountCodes: true,
  },
  checkout: {
    enableGuestCheckout: true,
    requirePhoneNumber: false,
    showOrderNotes: true,
    showNewsletterSignup: true,
    enableExpressCheckout: true,
  },
  shipping: {
    showEstimatedDelivery: true,
    defaultShippingMessage: 'Free shipping on orders over $50',
    internationalShipping: false,
  },
  policies: {
    returnPolicy: '',
    shippingPolicy: '',
    privacyPolicy: '',
  },
};

export function StoreSettingsPanel({
  settings,
  onChange,
}: StoreSettingsPanelProps) {
  const [data, setData] = useState<StoreSettings>(settings || defaultSettings);
  const [prevSettings, setPrevSettings] = useState(settings);

  // Sync local state when the settings prop changes from the parent.
  // Adjust during render via a prev-prop comparison instead of an effect so
  // users never see a stale frame and the React Compiler can optimize this.
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setData(settings || defaultSettings);
  }

  const handleChange = <K extends keyof StoreSettings>(
    section: K,
    field: keyof StoreSettings[K],
    value: StoreSettings[K][keyof StoreSettings[K]]
  ) => {
    const updated = {
      ...data,
      [section]: {
        ...data[section],
        [field]: value,
      },
    };
    setData(updated);
    onChange(updated);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold mb-1">Store Settings</h2>
          <p className="text-sm text-muted-foreground">
            Customize your store's product pages, cart, and checkout experience
          </p>
        </div>

        {/* Product Page Settings */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-primary" />
            <h3 className="font-medium">Product Page Layout</h3>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="product-layout">Page Layout</Label>
              <Select
                value={data.productPage.layout}
                onValueChange={(value) => {
                  if (
                    PRODUCT_PAGE_LAYOUTS.includes(value as ProductPageLayout)
                  ) {
                    handleChange(
                      'productPage',
                      'layout',
                      value as ProductPageLayout
                    );
                  }
                }}
              >
                <SelectTrigger id="product-layout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">
                    Standard (Images Left)
                  </SelectItem>
                  <SelectItem value="wide">Wide (Full Width)</SelectItem>
                  <SelectItem value="sidebar">
                    Sidebar (Images + Info)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="gallery-style">Image Gallery Style</Label>
              <Select
                value={data.productPage.imageGalleryStyle}
                onValueChange={(value) => {
                  if (
                    IMAGE_GALLERY_STYLES.includes(value as ImageGalleryStyle)
                  ) {
                    handleChange(
                      'productPage',
                      'imageGalleryStyle',
                      value as ImageGalleryStyle
                    );
                  }
                }}
              >
                <SelectTrigger id="gallery-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thumbnails">Thumbnails</SelectItem>
                  <SelectItem value="dots">Dots Navigation</SelectItem>
                  <SelectItem value="slider">Slider Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Image Zoom</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow customers to zoom into product images
                  </p>
                </div>
                <Switch
                  checked={data.productPage.enableZoom}
                  onCheckedChange={(checked) =>
                    handleChange('productPage', 'enableZoom', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Related Products</Label>
                  <p className="text-xs text-muted-foreground">
                    Display similar products at the bottom
                  </p>
                </div>
                <Switch
                  checked={data.productPage.showRelatedProducts}
                  onCheckedChange={(checked) =>
                    handleChange('productPage', 'showRelatedProducts', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Customer Reviews</Label>
                  <p className="text-xs text-muted-foreground">
                    Display product reviews and ratings
                  </p>
                </div>
                <Switch
                  checked={data.productPage.showReviews}
                  onCheckedChange={(checked) =>
                    handleChange('productPage', 'showReviews', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Share Buttons</Label>
                  <p className="text-xs text-muted-foreground">
                    Social media sharing buttons
                  </p>
                </div>
                <Switch
                  checked={data.productPage.showShareButtons}
                  onCheckedChange={(checked) =>
                    handleChange('productPage', 'showShareButtons', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Inventory Count</Label>
                  <p className="text-xs text-muted-foreground">
                    Display "Only X left in stock" messages
                  </p>
                </div>
                <Switch
                  checked={data.productPage.showInventory}
                  onCheckedChange={(checked) =>
                    handleChange('productPage', 'showInventory', checked)
                  }
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Cart Settings */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-4 text-primary" />
            <h3 className="font-medium">Shopping Cart</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Cart Drawer</Label>
                <p className="text-xs text-muted-foreground">
                  Show cart in a slide-out drawer instead of separate page
                </p>
              </div>
              <Switch
                checked={data.cart.enableCartDrawer}
                onCheckedChange={(checked) =>
                  handleChange('cart', 'enableCartDrawer', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Shipping Estimate</Label>
                <p className="text-xs text-muted-foreground">
                  Display calculated shipping costs in cart
                </p>
              </div>
              <Switch
                checked={data.cart.showShippingEstimate}
                onCheckedChange={(checked) =>
                  handleChange('cart', 'showShippingEstimate', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Progress Bar</Label>
                <p className="text-xs text-muted-foreground">
                  Display progress towards free shipping
                </p>
              </div>
              <Switch
                checked={data.cart.showProgressBar}
                onCheckedChange={(checked) =>
                  handleChange('cart', 'showProgressBar', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Gift Messages</Label>
                <p className="text-xs text-muted-foreground">
                  Allow customers to add gift messages
                </p>
              </div>
              <Switch
                checked={data.cart.enableGiftMessage}
                onCheckedChange={(checked) =>
                  handleChange('cart', 'enableGiftMessage', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Discount Codes</Label>
                <p className="text-xs text-muted-foreground">
                  Show discount code input field
                </p>
              </div>
              <Switch
                checked={data.cart.enableDiscountCodes}
                onCheckedChange={(checked) =>
                  handleChange('cart', 'enableDiscountCodes', checked)
                }
              />
            </div>

            {data.cart.showProgressBar && (
              <div>
                <Label htmlFor="free-shipping">
                  Free Shipping Threshold ($)
                </Label>
                <Input
                  id="free-shipping"
                  type="number"
                  min="0"
                  value={
                    data.cart.freeShippingThreshold ??
                    DEFAULT_FREE_SHIPPING_THRESHOLD
                  }
                  onChange={(e) => {
                    handleChange(
                      'cart',
                      'freeShippingThreshold',
                      validateFreeShippingThreshold(e.target.value)
                    );
                  }}
                  placeholder={String(DEFAULT_FREE_SHIPPING_THRESHOLD)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Show free shipping progress when cart reaches this amount
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Checkout Settings */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-primary" />
            <h3 className="font-medium">Checkout Experience</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Guest Checkout</Label>
                <p className="text-xs text-muted-foreground">
                  Allow purchases without creating an account
                </p>
              </div>
              <Switch
                checked={data.checkout.enableGuestCheckout}
                onCheckedChange={(checked) =>
                  handleChange('checkout', 'enableGuestCheckout', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Phone Number</Label>
                <p className="text-xs text-muted-foreground">
                  Make phone number mandatory at checkout
                </p>
              </div>
              <Switch
                checked={data.checkout.requirePhoneNumber}
                onCheckedChange={(checked) =>
                  handleChange('checkout', 'requirePhoneNumber', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Order Notes</Label>
                <p className="text-xs text-muted-foreground">
                  Allow customers to add special instructions
                </p>
              </div>
              <Switch
                checked={data.checkout.showOrderNotes}
                onCheckedChange={(checked) =>
                  handleChange('checkout', 'showOrderNotes', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Newsletter Signup</Label>
                <p className="text-xs text-muted-foreground">
                  Offer email list signup at checkout
                </p>
              </div>
              <Switch
                checked={data.checkout.showNewsletterSignup}
                onCheckedChange={(checked) =>
                  handleChange('checkout', 'showNewsletterSignup', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Express Checkout</Label>
                <p className="text-xs text-muted-foreground">
                  Apple Pay, Google Pay, Shop Pay buttons
                </p>
              </div>
              <Switch
                checked={data.checkout.enableExpressCheckout}
                onCheckedChange={(checked) =>
                  handleChange('checkout', 'enableExpressCheckout', checked)
                }
              />
            </div>
          </div>
        </Card>

        {/* Shipping Settings */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Truck className="size-4 text-primary" />
            <h3 className="font-medium">Shipping Options</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Estimated Delivery</Label>
                <p className="text-xs text-muted-foreground">
                  Display estimated delivery dates
                </p>
              </div>
              <Switch
                checked={data.shipping.showEstimatedDelivery}
                onCheckedChange={(checked) =>
                  handleChange('shipping', 'showEstimatedDelivery', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>International Shipping</Label>
                <p className="text-xs text-muted-foreground">
                  Enable shipping to international addresses
                </p>
              </div>
              <Switch
                checked={data.shipping.internationalShipping}
                onCheckedChange={(checked) =>
                  handleChange('shipping', 'internationalShipping', checked)
                }
              />
            </div>

            <div>
              <Label htmlFor="shipping-message">Default Shipping Message</Label>
              <Input
                id="shipping-message"
                value={data.shipping.defaultShippingMessage}
                onChange={(e) =>
                  handleChange(
                    'shipping',
                    'defaultShippingMessage',
                    e.target.value
                  )
                }
                placeholder="Free shipping on orders over $50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Displayed in cart and product pages
              </p>
            </div>
          </div>
        </Card>

        {/* Store Policies */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <h3 className="font-medium">Store Policies</h3>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="return-policy">Return Policy</Label>
              <Textarea
                id="return-policy"
                value={data.policies.returnPolicy || ''}
                onChange={(e) =>
                  handleChange('policies', 'returnPolicy', e.target.value)
                }
                placeholder="30-day return policy on all items..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Displayed on product pages and footer
              </p>
            </div>

            <div>
              <Label htmlFor="shipping-policy">Shipping Policy</Label>
              <Textarea
                id="shipping-policy"
                value={data.policies.shippingPolicy || ''}
                onChange={(e) =>
                  handleChange('policies', 'shippingPolicy', e.target.value)
                }
                placeholder="Orders ship within 1-2 business days..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Displayed in cart and checkout
              </p>
            </div>

            <div>
              <Label htmlFor="privacy-policy">
                Privacy Policy (URL or Text)
              </Label>
              <Textarea
                id="privacy-policy"
                value={data.policies.privacyPolicy || ''}
                onChange={(e) =>
                  handleChange('policies', 'privacyPolicy', e.target.value)
                }
                placeholder="https://yoursite.com/privacy or full policy text..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Required for legal compliance
              </p>
            </div>
          </div>
        </Card>

        {/* Tips */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <AlertCircle className="size-4 text-primary" />
            Store Settings Tips
          </h4>
          <ul className="text-xs space-y-1.5 text-muted-foreground">
            <li>• Enable guest checkout to reduce cart abandonment</li>
            <li>• Show progress bars to encourage free shipping purchases</li>
            <li>• Product reviews increase trust and conversions</li>
            <li>• Clear shipping and return policies reduce support tickets</li>
            <li>• Express checkout options can double conversion rates</li>
          </ul>
        </Card>
      </div>
    </ScrollArea>
  );
}
