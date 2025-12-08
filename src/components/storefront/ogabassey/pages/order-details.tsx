'use client';

import {
    CheckCircle2,
    ChevronLeft,
    Clock,
    CreditCard,
    Download,
    MapPin,
    Package,
    ShoppingBag,
    Truck,
    XCircle,
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useState } from 'react';
import { EmptyState } from './empty-state';

// Inlined mock orders to avoid dependencies
const ORDERS = [
    {
        id: 'ORD-2024-001',
        date: 'May 12, 2024',
        total: '₦1,850,000',
        status: 'Delivered',
        paymentMethod: 'Bank Transfer',
        shippingAddress: '12 Victoria Island, Lagos',
        items: [
            {
                id: '1',
                name: 'iPhone 15 Pro Max',
                description: '256GB - Natural Titanium',
                price: '₦1,800,000',
                image: 'https://fdn2.gsmarena.com/vv/bigpic/apple-iphone-15-pro-max.jpg',
                quantity: 1,
            },
        ],
    },
];

export const OgabasseyV2OrderDetails: React.FC = () => {
    // const navigate = useNavigate();
    // const { addToCart } = useCart();
    const [order] = useState<(typeof ORDERS)[0] | null>(ORDERS[0]); // Mock selecting the first order
    // const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);

    // useEffect(() => {
    //    window.scrollTo(0, 0);
    // }, []);

    if (!order) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-20">
                <EmptyState
                    title="Order Not Found"
                    description="We couldn't find the order you are looking for."
                    actionLabel="Back to Orders"
                    actionLink="/orders"
                    variant="generic"
                />
            </div>
        );
    }

    const handleBuyAgain = () => {
        /*
        order.items.forEach((item) => {
          addToCart(item, 1);
        });
        navigate('/cart');
        */
        console.log('Buy again clicked');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Processing':
                return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'Delivered':
                return 'bg-green-50 text-green-600 border-green-100';
            case 'Cancelled':
                return 'bg-red-50 text-red-600 border-red-100';
            case 'Shipped':
                return 'bg-amber-50 text-amber-600 border-amber-100';
            default:
                return 'bg-gray-50 text-gray-600 border-gray-100';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Processing':
                return <Clock size={16} />;
            case 'Delivered':
                return <CheckCircle2 size={16} />;
            case 'Cancelled':
                return <XCircle size={16} />;
            case 'Shipped':
                return <Truck size={16} />;
            default:
                return <Package size={16} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
            <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
                {/* Breadcrumb / Back */}
                <div className="flex items-center gap-4 mb-6">
                    <Link
                        href="/orders"
                        className="p-2 hover:bg-white rounded-full transition-colors text-gray-500 hover:text-gray-900 border border-transparent hover:border-gray-200"
                    >
                        <ChevronLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Order Details</h1>
                        <p className="text-xs text-gray-500">
                            #{order.id} • {order.date}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Status Card */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-gray-900">Order Status</h2>
                                <span
                                    className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 uppercase tracking-wide ${getStatusColor(order.status)}`}
                                >
                                    {getStatusIcon(order.status)} {order.status}
                                </span>
                            </div>
                            {/* Progress Bar (Visual only for now) */}
                            <div className="relative pt-4 pb-2">
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${order.status === 'Delivered' ? 'bg-green-500 w-full' : order.status === 'Cancelled' ? 'bg-red-500 w-full' : 'bg-blue-500 w-1/3'}`}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-wide">
                                    <span>Placed</span>
                                    <span>Processing</span>
                                    <span>Shipped</span>
                                    <span>Delivered</span>
                                </div>
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                                <h2 className="font-bold text-gray-900 text-sm">
                                    Items ({order.items.length})
                                </h2>
                            </div>
                            <div className="p-4 space-y-4">
                                {order.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex gap-4 items-start pb-4 border-b border-gray-50 last:border-0 last:pb-0"
                                    >
                                        <Link
                                            href={`/product/${item.id}` as any}
                                            className="w-20 h-20 bg-gray-50 rounded-xl p-2 border border-gray-100 flex-shrink-0 block"
                                        >
                                            <img
                                                src={item.image}
                                                alt={item.name}
                                                className="w-full h-full object-contain mix-blend-multiply"
                                            />
                                        </Link>
                                        <div className="flex-1 min-w-0">
                                            <Link href={`/product/${item.id}` as any}>
                                                <h3 className="font-bold text-gray-900 text-sm mb-1 hover:text-red-600 transition-colors">
                                                    {item.name}
                                                </h3>
                                            </Link>
                                            <p className="text-xs text-gray-500 mb-2">
                                                {item.description}
                                            </p>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-bold text-gray-900">
                                                    {item.price}
                                                </span>
                                                <span className="text-xs text-gray-500">Qty: 1</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Order Summary */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                            <h3 className="font-bold text-gray-900 text-sm mb-4">
                                Order Summary
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between text-gray-500">
                                    <span>Subtotal</span>
                                    <span>{order.total}</span>
                                </div>
                                <div className="flex justify-between text-gray-500">
                                    <span>Delivery</span>
                                    <span className="text-green-600">Free</span>
                                </div>
                                <div className="border-t border-dashed border-gray-200 pt-3 flex justify-between font-bold text-lg text-gray-900">
                                    <span>Total</span>
                                    <span>{order.total}</span>
                                </div>
                            </div>
                        </div>

                        {/* Delivery & Payment Info */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-6">
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <MapPin size={14} /> Delivery Details
                                </h4>
                                <p className="text-sm font-bold text-gray-900">
                                    Standard Delivery
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                    {order.shippingAddress}
                                </p>
                            </div>
                            <div className="border-t border-gray-50 pt-4">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <CreditCard size={14} /> Payment Method
                                </h4>
                                <p className="text-sm font-bold text-gray-900">
                                    {order.paymentMethod}
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                            <button
                                type="button"
                                // onClick={() => setIsInvoiceOpen(true)}
                                className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                            >
                                <Download size={18} /> Download Invoice
                            </button>
                            <button
                                type="button"
                                onClick={handleBuyAgain}
                                className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-lg active:scale-95"
                            >
                                <ShoppingBag size={18} /> Buy Again
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
