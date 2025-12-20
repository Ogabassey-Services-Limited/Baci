
import React from 'react';
import { History, ShoppingCart, Calendar, ArrowRight, ExternalLink } from 'lucide-react';
import { products } from '../data/products';
import { useCart } from '../contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from './EmptyState';

export const PurchaseHistoryPage: React.FC = () => {
  const { addToCart } = useCart();
  const navigate = useNavigate();

  // Mock Purchase History Data (Flat list of items)
  const purchasedItems = [
    {
      purchaseId: "PUR-9921",
      date: "Jan 15, 2024",
      product: products[0],
      price: products[0].price,
      quantity: 1
    },
    {
      purchaseId: "PUR-9921",
      date: "Jan 15, 2024",
      product: products[4],
      price: products[4].price,
      quantity: 1
    },
    {
      purchaseId: "PUR-8810",
      date: "Dec 10, 2023",
      product: products[2],
      price: products[2].price,
      quantity: 1
    },
    {
      purchaseId: "PUR-7723",
      date: "Nov 05, 2023",
      product: products[6],
      price: products[6].price,
      quantity: 2
    }
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
                            <img src={item.product.image} alt={item.product.name} className="w-full h-full object-contain mix-blend-multiply" />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                <Calendar size={12} />
                                <span>Purchased on {item.date}</span>
                            </div>
                            <h3 className="font-bold text-gray-900 text-sm md:text-base mb-1 truncate">{item.product.name}</h3>
                            <p className="text-sm font-bold text-red-600">{item.price}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                            <button 
                                onClick={() => {
                                    addToCart(item.product, 1);
                                    navigate('/cart');
                                }}
                                className="flex-1 md:flex-none bg-gray-900 text-white text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2 shadow-sm active:scale-95"
                            >
                                <ShoppingCart size={14} /> Buy Again
                            </button>
                            <button className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors">
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
