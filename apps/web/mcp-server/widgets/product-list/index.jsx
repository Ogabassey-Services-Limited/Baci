import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// Ogabassey Product List Widget
// Follows Pizza example pattern with proper state management

function ProductCard({ product, onAddToCart, isInCart }) {
  return (
    <div className="product-card">
      <div className="product-image">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className="no-image"
          style={{ display: product.image_url ? 'none' : 'flex' }}
        >
          No Image
        </div>
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <div className="product-price">
          <span className="current-price">
            ₦{product.price?.toLocaleString()}
          </span>
          {product.compare_at_price &&
            product.compare_at_price > product.price && (
              <span className="original-price">
                ₦{product.compare_at_price?.toLocaleString()}
              </span>
            )}
        </div>
        <div className="product-meta">
          {product.condition && (
            <span className="badge condition">{product.condition}</span>
          )}
          {product.stock_level && (
            <span className="badge stock">{product.stock_level}</span>
          )}
        </div>
      </div>
      <div className="product-actions">
        <button type="button"
          className={`btn-cart ${isInCart ? 'in-cart' : ''}`}
          onClick={() => onAddToCart(product)}
        >
          {isInCart ? '✓ In Cart' : '+ Add to Cart'}
        </button>
        <button type="button" className="btn-buy">Buy Now</button>
      </div>
    </div>
  );
}

function CartSummary({ items, onViewCart }) {
  const total = items.reduce((sum, item) => sum + (item.price || 0), 0);

  if (items.length === 0) return null;

  return (
    <div className="cart-summary">
      <span>
        {items.length} item{items.length > 1 ? 's' : ''} in cart
      </span>
      <span className="cart-total">₦{total.toLocaleString()}</span>
      <button type="button" className="btn-checkout" onClick={onViewCart}>
        Checkout →
      </button>
    </div>
  );
}

function App() {
  // Get data from MCP tool output
  const toolOutput = window.openai?.toolOutput || {};
  const products = toolOutput.products || [];

  // Persist cart state across widget renders
  const [cart, setCart] = useState(() => {
    return window.openai?.widgetState?.cart || [];
  });

  // Sync cart to widget state for persistence
  useEffect(() => {
    if (window.openai?.setWidgetState) {
      window.openai.setWidgetState({ cart });
    }
  }, [cart]);

  const handleAddToCart = async (product) => {
    // Check if already in cart
    if (cart.find((p) => p.id === product.id)) {
      return;
    }

    // Update local state
    setCart((prev) => [...prev, product]);

    // Call MCP tool to register cart server-side (optional)
    if (window.openai?.callTool) {
      try {
        await window.openai.callTool('add_to_cart', {
          product_id: product.id,
          session_id: window.openai?.widgetState?.sessionId || 'default',
        });
      } catch (err) {
        console.error('Failed to sync cart:', err);
      }
    }
  };

  const handleViewCart = async () => {
    if (window.openai?.callTool) {
      try {
        await window.openai.callTool('view_cart', {
          session_id: window.openai?.widgetState?.sessionId || 'default',
        });
      } catch (err) {
        console.error('Failed to view cart:', err);
      }
    }
  };

  return (
    <div className="ogabassey-widget">
      <header className="widget-header">
        <div className="brand">
          <div className="brand-logo">OGA</div>
          <div className="brand-info">
            <h1>Ogabassey</h1>
            <p>Premium Tech & Gadgets</p>
          </div>
        </div>
        <CartSummary items={cart} onViewCart={handleViewCart} />
      </header>

      <div className="products-grid">
        {products.length === 0 ? (
          <div className="empty-state">No products found</div>
        ) : (
          products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={handleAddToCart}
              isInCart={cart.some((p) => p.id === product.id)}
            />
          ))
        )}
      </div>

      <footer className="widget-footer">
        <button type="button"
          className="btn-see-more"
          onClick={() => {
            if (window.openai?.openExternal) {
              window.openai.openExternal('https://ogabassey.com');
            }
          }}
        >
          See More Products →
        </button>
      </footer>
    </div>
  );
}

// Mount the app
const root = document.getElementById('ogabassey-root');
if (root) {
  createRoot(root).render(<App />);
}
