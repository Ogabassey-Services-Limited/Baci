
import React, { useState } from 'react';
import { X, Download } from 'lucide-react';
import { Logo } from './Logo';
import { Product } from '../types';

// Define interface to match the structure in data/orders
export interface InvoiceOrderData {
    id: string;
    date: string;
    time: string;
    total: string;
    status: string;
    paymentMethod: string;
    shippingAddress: string;
    items: Product[];
}

interface InvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: InvoiceOrderData | null;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, order }) => {
    const [isDownloading, setIsDownloading] = useState(false);

    if (!isOpen || !order) return null;

    const handleDownload = () => {
        setIsDownloading(true);
        // Simulate PDF generation and download delay
        setTimeout(() => {
            setIsDownloading(false);
            // In a real application, you would trigger the file download here
            alert(`Invoice #${order.id} downloaded successfully.`);
            onClose();
        }, 1500);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl relative z-10 flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl shrink-0">
                    <h3 className="font-bold text-gray-900">Invoice Preview</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Preview Area - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
                    {/* A4 Paper Container */}
                    <div className="bg-white shadow-xl border border-gray-200 p-12 md:p-16 min-h-[1123px] relative mx-auto max-w-[794px] flex flex-col"> 
                        
                        {/* Decorative Top Bar */}
                        <div className="absolute top-0 left-0 right-0 h-2 bg-red-600"></div>

                        {/* Invoice Header */}
                        <div className="flex justify-between items-start mb-20 mt-4">
                            <div>
                                <Logo className="h-12 w-auto text-gray-900 mb-6" />
                                <div className="text-sm text-gray-500 leading-relaxed font-medium">
                                    <p className="font-bold text-gray-900 text-base mb-1">Ogabassey Ltd.</p>
                                    <p>2 Olaide Tomori St, Ikeja</p>
                                    <p>Lagos, Nigeria</p>
                                    <p>+234 814 697 8921</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight mb-2">INVOICE</h1>
                                <p className="text-gray-500 font-medium text-lg">#{order.id}</p>
                            </div>
                        </div>

                        {/* Bill To & Details */}
                        <div className="grid grid-cols-2 gap-16 mb-16 border-b-2 border-gray-100 pb-16">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Billed To</p>
                                <p className="font-bold text-gray-900 text-xl mb-2">Alex Doe</p>
                                <p className="text-gray-600 leading-relaxed">{order.shippingAddress}</p>
                                <p className="text-gray-600">Lagos, Nigeria</p>
                            </div>
                            <div className="text-right space-y-8">
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Date Issued</p>
                                    <p className="font-medium text-gray-900 text-xl">{order.date}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total Amount</p>
                                    <p className="font-bold text-red-600 text-4xl">{order.total}</p>
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="mb-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b-2 border-gray-100">
                                        <th className="pb-6 text-xs font-bold text-gray-400 uppercase tracking-wider w-1/2">Item Description</th>
                                        <th className="pb-6 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Qty</th>
                                        <th className="pb-6 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Price</th>
                                        <th className="pb-6 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {order.items.map((item, index) => (
                                        <tr key={index}>
                                            <td className="py-8">
                                                <p className="font-bold text-gray-900 text-lg mb-1">{item.name}</p>
                                                <p className="text-sm text-gray-500">{item.condition} - {item.brand}</p>
                                            </td>
                                            <td className="py-8 text-center text-gray-600 font-medium">1</td>
                                            <td className="py-8 text-right text-gray-600 font-medium">{item.price}</td>
                                            <td className="py-8 text-right font-bold text-gray-900 text-lg">{item.price}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals */}
                        <div className="flex justify-end mt-16 mb-24">
                            <div className="w-5/12 space-y-5">
                                <div className="flex justify-between text-gray-600 text-lg">
                                    <span>Subtotal</span>
                                    <span className="font-medium">{order.total}</span>
                                </div>
                                <div className="flex justify-between text-gray-600 text-lg">
                                    <span>Tax (0%)</span>
                                    <span className="font-medium">₦0.00</span>
                                </div>
                                <div className="flex justify-between text-gray-600 text-lg">
                                    <span>Shipping</span>
                                    <span className="text-green-600 font-medium">Free</span>
                                </div>
                                <div className="border-t-2 border-gray-900 pt-6 flex justify-between items-center">
                                    <span className="text-xl font-bold text-gray-900">Total</span>
                                    <span className="text-3xl font-extrabold text-gray-900">{order.total}</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Footer Notes */}
                        <div className="mt-auto border-t border-gray-100 pt-10 text-center">
                            <p className="text-sm text-gray-600 mb-2">
                                Payment Method: <span className="font-bold text-gray-900 uppercase">{order.paymentMethod}</span>
                            </p>
                            <p className="text-sm text-gray-400 italic">Thank you for shopping with Ogabassey!</p>
                            <p className="text-xs text-gray-300 mt-8">Generated via Ogabassey Platform</p>
                        </div>
                    </div>
                </div>

                {/* Footer / Download Button */}
                <div className="p-4 border-t border-gray-100 bg-white rounded-b-2xl flex justify-center shrink-0">
                    <button 
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="bg-gray-900 hover:bg-black text-white font-bold py-3.5 px-10 rounded-xl shadow-lg transition-all flex items-center gap-3 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed w-full md:w-auto justify-center"
                    >
                        {isDownloading ? (
                            <span className="flex items-center gap-2">Processing...</span>
                        ) : (
                            <>
                                <Download size={20} /> Download PDF Invoice
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
