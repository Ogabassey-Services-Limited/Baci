import React, { useState } from 'react';
import { Package, Truck, CheckCircle2, Clock, ChevronRight, XCircle, Search, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { orders } from '../data/orders';
import { EmptyState } from './EmptyState';

export const OrdersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Filter Logic
  const filteredOrders = orders.filter(order => {
      const query = searchQuery.toLowerCase();
      return (
          order.id.toLowerCase().includes(query) ||
          order.status.toLowerCase().includes(query) ||
          order.items.some(item => item.name.toLowerCase().includes(query))
      );
  });

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'Processing': return 'bg-blue-50 text-blue-600 border-blue-100';
          case 'Delivered': return 'bg-green-50 text-green-600 border-green-100';
          case 'Cancelled': return 'bg-red-50 text-red-600 border-red-100';
          case 'Shipped': return 'bg-amber-50 text-amber-600 border-amber-100';
          default: return 'bg-gray-50 text-gray-600 border-gray-100';
      }
  };

  const getStatusIcon = (status: string) => {
      switch(status) {
          case 'Processing': return <Clock size={14} />;
          case 'Delivered': return <CheckCircle2 size={14} />;
          case 'Cancelled': return <XCircle size={14} />;
          case 'Shipped': return <Truck size={14} />;
          default: return <Package size={14} />;
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="text-red-600 fill-red-600" />
            My Orders
            </h1>

             <div className="relative w-full md:w-96">
                <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Order ID, Item or Status..." 
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-200 transition-all text-sm"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
        </div>

        {orders.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
                <EmptyState 
                    variant="orders"
                    title="No orders yet" 
                    description="Looks like you haven't placed any orders yet. Start shopping to fill this page." 
                    actionLabel="Start Shopping" 
                    actionLink="/"
                />
            </div>
        ) : filteredOrders.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-20">
                 <div className="text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200">
                        <Search className="text-gray-400" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">No orders found</h3>
                    <p className="text-gray-500 text-sm">We couldn't find any orders matching "{searchQuery}"</p>
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="mt-4 text-red-600 font-bold text-sm hover:underline"
                    >
                        Clear Search
                    </button>
                 </div>
            </div>
        ) : (
            <div className="space-y-4">
                {filteredOrders.map((order) => (
                    <div 
                        key={order.id} 
                        className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 group active:scale-[0.99]"
                    >
                        {/* Order Header */}
                        <div className="p-4 md:p-6 border-b border-gray-50 flex flex-wrap gap-4 justify-between items-center bg-gray-50/30">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="font-bold text-gray-900 text-sm">{order.id}</h3>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 uppercase tracking-wide ${getStatusColor(order.status)}`}>
                                        {getStatusIcon(order.status)} {order.status}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500">{order.date}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-500 mb-0.5">Total Amount</p>
                                <p className="font-bold text-gray-900">{order.total}</p>
                            </div>
                        </div>

                        {/* Order Items */}
                        <div className="p-4 md:p-6">
                            <div className="flex flex-col gap-4">
                                {order.items.map((item, idx) => (
                                    <Link key={idx} to={`/product/${item.id}`} className="flex gap-4 items-center group/item hover:bg-gray-50 p-2 rounded-xl transition-colors -mx-2">
                                        <div className="w-16 h-16 bg-gray-50 rounded-lg p-2 border border-gray-100 flex-shrink-0 group-hover/item:bg-white group-hover/item:border-red-100 transition-colors">
                                            <img src={item.image} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-sm text-gray-900 line-clamp-1 group-hover/item:text-red-600 transition-colors">{item.name}</h4>
                                            <p className="text-xs text-gray-500 line-clamp-1">{item.description}</p>
                                        </div>
                                        {order.items.length === 1 && (
                                            <button className="text-xs font-bold text-red-600 hover:text-red-700 whitespace-nowrap hidden sm:block bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                                                Buy Again
                                            </button>
                                        )}
                                    </Link>
                                ))}
                            </div>
                            
                            <div className="mt-6 pt-4 border-t border-gray-50 flex justify-between items-center">
                                <span className="text-xs text-gray-400">{order.items.length} item(s)</span>
                                <Link 
                                    to={`/order/${order.id}`}
                                    className="text-sm font-bold text-gray-900 flex items-center gap-1 hover:text-red-600 transition-colors"
                                >
                                    View Details <ChevronRight size={16} />
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};