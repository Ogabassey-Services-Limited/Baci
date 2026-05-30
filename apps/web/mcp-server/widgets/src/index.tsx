import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useOpenAiGlobal } from './hooks/use-openai-global';
import { useWidgetState } from './hooks/use-widget-state';

// Types
interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price?: number;
  image_url?: string;
  images?: string[];
  condition?: string;
  stock_level?: string;
  brand?: string;
  category?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface WidgetState {
  cart: CartItem[];
  cartId?: string;
  [key: string]: unknown; // Index signature for type compatibility
}

const createDefaultState = (): WidgetState => ({
  cart: [],
});

// Format price in Naira
const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(price);
};

// Product Card Component
function ProductCard({
  product,
  isInCart,
  onAddToCart,
}: {
  product: Product;
  isInCart: boolean;
  onAddToCart: (product: Product) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const hasDiscount =
    product.compare_at_price && product.compare_at_price > product.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.compare_at_price!) * 100)
    : 0;

  return (
    <div className="product-card">
      <div className="product-image">
        {product.image_url && !imageError ? (
          <img
            src={product.image_url}
            alt={product.name}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="no-image">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </div>
        )}
        {hasDiscount && (
          <span className="badge-discount">-{discountPercent}%</span>
        )}
        {product.condition && product.condition !== 'new' && (
          <span className="badge-condition">{product.condition}</span>
        )}
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <div className="product-price">
          <span className="current-price">{formatPrice(product.price)}</span>
          {hasDiscount && (
            <span className="original-price">
              {formatPrice(product.compare_at_price!)}
            </span>
          )}
        </div>
        {product.stock_level && (
          <span className="stock-badge">{product.stock_level}</span>
        )}
      </div>
      <div className="product-actions">
        <button type="button"
          className={`btn-add-cart ${isInCart ? 'in-cart' : ''}`}
          onClick={() => onAddToCart(product)}
          disabled={isInCart}
        >
          {isInCart ? (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Added
            </>
          ) : (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Add to Cart
            </>
          )}
        </button>
        <button type="button"
          className="btn-buy-now"
          onClick={() => {
            const url = `https://ogabassey.com/ogabassey/cart?item_id=${product.id}`;
            window.openai?.openExternal?.({ href: url }) ||
              window.open(url, '_blank');
          }}
        >
          Buy Now
        </button>
      </div>
    </div>
  );
}

// Cart Summary Component
function CartSummary({
  cart,
  onViewCart,
  onRemoveItem,
}: {
  cart: CartItem[];
  onViewCart: () => void;
  onRemoveItem: (productId: string) => void;
}) {
  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (cart.length === 0) return null;

  return (
    <div className="cart-summary">
      <div className="cart-header">
        <span className="cart-count">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </span>
        <span className="cart-total">{formatPrice(total)}</span>
      </div>
      <div className="cart-items">
        {cart.map((item) => (
          <div key={item.product.id} className="cart-item">
            <span className="cart-item-name">{item.product.name}</span>
            <span className="cart-item-qty">×{item.quantity}</span>
            <button type="button"
              className="cart-item-remove"
              onClick={() => onRemoveItem(item.product.id)}
              aria-label={`Remove ${item.product.name}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn-checkout" onClick={onViewCart}>
        Proceed to Checkout →
      </button>
    </div>
  );
}

// Main App Component
function App() {
  const toolOutput = useOpenAiGlobal('toolOutput') as {
    products?: Product[];
  } | null;
  const theme = useOpenAiGlobal('theme') || 'dark';
  const [widgetState, setWidgetState] =
    useWidgetState<WidgetState>(createDefaultState);

  const cart = widgetState?.cart || [];
  const products = toolOutput?.products || [];

  // Add item to cart
  const handleAddToCart = async (product: Product) => {
    // Optimistic UI update
    setWidgetState((prev) => {
      const existingItem = prev?.cart.find(
        (item) => item.product.id === product.id
      );
      if (existingItem) {
        return prev; // Already in cart
      }
      return {
        ...prev!,
        cart: [...(prev?.cart || []), { product, quantity: 1 }],
      };
    });

    // Call server tool to sync cart
    try {
      await window.openai?.callTool?.('add_to_cart', {
        product_id: product.id,
        session_id: widgetState?.cartId || 'default',
      });

      // Send follow-up message so assistant knows what happened
      window.openai?.sendFollowUpMessage?.(`Added ${product.name} to cart.`);
    } catch (error) {
      console.error('Failed to sync cart:', error);
    }
  };

  // Remove item from cart
  const handleRemoveItem = (productId: string) => {
    setWidgetState((prev) => ({
      ...prev!,
      cart: prev?.cart.filter((item) => item.product.id !== productId) || [],
    }));
  };

  // View cart / checkout
  const handleViewCart = () => {
    if (cart.length === 0) return;

    const itemIds = cart.map((item) => item.product.id).join(',');
    const checkoutUrl = `https://ogabassey.com/ogabassey/cart?item_id=${itemIds}`;
    window.openai?.openExternal?.({ href: checkoutUrl }) ||
      window.open(checkoutUrl, '_blank');
  };

  return (
    <div className={`ogabassey-widget theme-${theme}`}>
      <header className="widget-header">
        <div className="brand">
          <div className="brand-logo">OGA</div>
          <div className="brand-text">
            <h1>Ogabassey</h1>
            <p>Premium Tech & Gadgets</p>
          </div>
        </div>
        {cart.length > 0 && (
          <button type="button" className="cart-badge" onClick={handleViewCart}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span className="cart-badge-count">{cart.length}</span>
          </button>
        )}
      </header>

      {products.length > 0 ? (
        <div className="products-grid">
          {products.slice(0, 6).map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isInCart={cart.some((item) => item.product.id === product.id)}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <p>Ask me to search for products!</p>
        </div>
      )}

      <CartSummary
        cart={cart}
        onViewCart={handleViewCart}
        onRemoveItem={handleRemoveItem}
      />

      {/* Mobile Sticky Footer */}
      {cart.length > 0 && (
        <div className="mobile-sticky-footer">
          <button type="button"
            className="btn-negotiate-icon"
            onClick={() => {
              window.openai?.sendFollowUpMessage?.(
                'I would like to negotiate the price for my cart items.'
              );
            }}
            aria-label="Negotiate Price"
            title="Negotiate Price"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M8 10h.01" />
              <path d="M12 10h.01" />
              <path d="M16 10h.01" />
            </svg>
          </button>
          <button type="button" className="btn-checkout-sticky" onClick={handleViewCart}>
            Proceed to Checkout →
          </button>
        </div>
      )}

      <footer className="widget-footer">
        <button type="button"
          className="btn-browse-more"
          onClick={() => {
            window.openai?.openExternal?.({ href: 'https://ogabassey.com' }) ||
              window.open('https://ogabassey.com', '_blank');
          }}
        >
          Browse All Products →
        </button>
      </footer>
    </div>
  );
}

// Mount
const rootEl = document.getElementById('ogabassey-root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
