'use client';

import { Calendar, ExternalLink, History, ShoppingCart } from 'lucide-react';
import type React from 'react';
import { EmptyState } from './empty-state';

// Inlined products needed for history
const products = [
  {
    id: '1',
    name: 'iPhone 15 Pro Max',
    price: '₦1,800,000',
    image: 'https://fdn2.gsmarena.com/vv/bigpic/apple-iphone-15-pro-max.jpg',
  },
  {
    id: '3',
    name: 'MacBook Pro 14"',
    price: '₦2,500,000',
    image: 'https://fdn2.gsmarena.com/vv/bigpic/apple-macbook-pro-14-2023.jpg',
  },
  {
    id: '5',
    name: 'PlayStation 5',
    price: '₦750,000',
    image:
      'https://gmedia.playstation.com/is/image/SIEPDC/ps5-product-thumbnail-01-en-14sep21?$facebook$',
  },
  {
    id: '7',
    name: 'iPad Pro 12.9"',
    price: '₦1,200,000',
    image: 'https://fdn2.gsmarena.com/vv/bigpic/apple-ipad-pro-129-2022.jpg',
  },
];

export const OgabasseyV2PurchaseHistory: React.FC = () => {
  // const { addToCart } = useCart();
  // const navigate = useNavigate();

  // Mock Purchase History Data (Flat list of items)
  const purchasedItems = [
    {
      purchaseId: 'PUR-9921',
      date: 'Jan 15, 2024',
      product: products[0],
      price: products[0].price,
      quantity: 1,
    },
    {
      purchaseId: 'PUR-9921',
      date: 'Jan 15, 2024',
      product: products[2],
      price: products[2].price,
      quantity: 1,
    },
    {
      purchaseId: 'PUR-8810',
      date: 'Dec 10, 2023',
      product: products[1],
      price: products[1].price,
      quantity: 1,
    },
    {
      purchaseId: 'PUR-7723',
      date: 'Nov 05, 2023',
      product: products[3],
      price: products[3].price,
      quantity: 2,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <History className="text-red-600 fill-red-600" />
          Purchase History
        </h1>

        {purchasedItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              variant="history"
              title="No purchase history"
              description="You haven't bought anything yet. Your purchased items will appear here."
              actionLabel="Start Shopping"
              actionLink="/"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {purchasedItems.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 flex flex-col md:flex-row gap-6 items-start md:items-center shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Image */}
                <div className="w-20 h-20 bg-gray-50 rounded-xl p-2 shrink-0 border border-gray-100 flex items-center justify-center">
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="w-full h-full object-contain mix-blend-multiply"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <Calendar size={12} />
                    <span>Purchased on {item.date}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm md:text-base mb-1 truncate">
                    {item.product.name}
                  </h3>
                  <p className="text-sm font-bold text-red-600">{item.price}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                  <button
                    type="button"
                    onClick={() => {
                      // addToCart(item.product, 1);
                      // navigate('/cart');
                      console.log('Buy again:', item.product.id);
                    }}
                    className="flex-1 md:flex-none bg-gray-900 text-white text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2 shadow-sm active:scale-95"
                  >
                    <ShoppingCart size={14} /> Buy Again
                  </button>
                  <button
                    type="button"
                    className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                  >
                    <ExternalLink size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
