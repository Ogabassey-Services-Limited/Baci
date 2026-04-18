'use client';

import { Download, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import { useCart } from '@/hooks/cart';
import { Logo } from './Logo';

export interface InvoiceItemData {
  id: string;
  name: string;
  price: string;
  image: string;
  condition?: string;
  brand?: string;
  category?: string;
  description?: string;
  rating?: number;
  reviews: number;
  countInStock: number;
}

// Define interface to match the structure in data/orders
export interface InvoiceOrderData {
  id: string;
  date: string;
  time: string;
  total: string;
  status: string;
  paymentMethod: string;
  shippingAddress: string;
  items: InvoiceItemData[];
  walletDeduction?: number;
}

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const { cart, cartTotal } = useCart();
  const _router = useRouter();

  // For now, we'll use a dummy order for display purposes since the prop is removed.
  // In a real scenario, you might fetch this based on a cart ID or generate it.
  const dummyOrder: InvoiceOrderData = {
    id: 'INV-000001',
    date: '2023-10-27',
    time: '10:30 AM',
    total: `₦${cartTotal.toLocaleString()} `,
    status: 'Pending',
    paymentMethod: 'Card',
    shippingAddress: '123 Main St, Anytown, USA',
    items: cart.map((item) => ({
      id: item.id,
      name: item.name,
      price: `₦${item.price.toLocaleString()} `,
      image: item.image,
      condition: item.condition,
      brand: item.brand,
      category: item.category,
      description: item.description,
      rating: item.rating,
      reviews: ('numReviews' in item ? Number(item.numReviews) : ('review_count' in item ? Number(item.review_count) : 0)) || 0,
      countInStock: item.stock || 0,
    })),
    walletDeduction: 0, // Example, adjust as needed
  };

  if (!isOpen) return null;

  const handleDownload = () => {
    setIsDownloading(true);
    // Simulate PDF generation and download delay
    setTimeout(() => {
      setIsDownloading(false);
      // In a real application, you would trigger the file download here
      alert(`Invoice #${dummyOrder.id} downloaded successfully.`);
      onClose();
    }, 1500);
  };

  // Calculate dynamic totals if wallet was used
  const totalVal = Number.parseFloat(dummyOrder.total.replace(/[^0-9.]/g, ''));
  const walletDed = dummyOrder.walletDeduction || 0;
  const amountDue = totalVal - walletDed;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl relative z-10 flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl shrink-0">
          <h3 className="font-bold text-gray-900">Invoice Preview</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Preview Area - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-100">
          {/* A4 Paper Container */}
          <div className="bg-white shadow-xl border border-gray-200 p-8 md:p-12 min-h-[1000px] relative mx-auto max-w-[794px] flex flex-col">
            {/* Decorative Top Bar */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-red-600" />

            {/* Invoice Header */}
            <div className="flex flex-col md:flex-row justify-between items-start mb-12 mt-4 gap-6">
              <div>
                <Logo className="h-10 w-auto text-gray-900 mb-4" />
                <div className="text-sm text-gray-500 leading-relaxed font-medium">
                  <p className="font-bold text-gray-900 text-base mb-1">
                    Ogabassey Ltd.
                  </p>
                  <p>2 Olaide Tomori St, Ikeja</p>
                  <p>Lagos, Nigeria</p>
                  <p>+234 814 697 8921</p>
                </div>
              </div>
              <div className="text-left md:text-right">
                <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-2">
                  INVOICE
                </h1>
                <p className="text-gray-500 font-medium text-lg">
                  #{dummyOrder.id}
                </p>
                <div className="mt-2 inline-block px-3 py-1 bg-red-50 text-red-600 text-xs font-bold uppercase tracking-widest rounded border border-red-100">
                  {walletDed > 0 ? 'Partially Paid' : 'Unpaid'}
                </div>
              </div>
            </div>

            {/* Bill To & Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 border-b border-gray-100 pb-12">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Billed To
                </p>
                <p className="font-bold text-gray-900 text-xl mb-1">Alex Doe</p>
                <p className="text-gray-600 leading-relaxed max-w-xs">
                  {dummyOrder.shippingAddress}
                </p>
                <p className="text-gray-600">Lagos, Nigeria</p>
              </div>
              <div className="md:text-right flex flex-col md:items-end justify-between space-y-4">
                <div className="grid grid-cols-2 gap-8 md:gap-4">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Date Issued
                    </p>
                    <p className="font-medium text-gray-900">
                      {dummyOrder.date}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Due Date
                    </p>
                    <p className="font-medium text-gray-900">
                      {dummyOrder.date}
                    </p>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 inline-block min-w-[200px] text-center md:text-right">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Amount Due
                  </p>
                  <p className="font-bold text-red-600 text-2xl">
                    ₦{amountDue.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-[50%]">
                      Item Description
                    </th>
                    <th className="pb-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="pb-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="pb-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dummyOrder.items.map((item, index) => (
                    <tr key={index}>
                      <td className="py-6 pr-4 align-top">
                        <p className="font-bold text-gray-900 text-base mb-1">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.condition} - {item.brand}
                        </p>
                      </td>
                      <td className="py-6 text-center text-gray-600 font-medium text-sm align-top pt-7">
                        1
                      </td>
                      <td className="py-6 text-right text-gray-600 font-medium text-sm align-top pt-7">
                        {item.price}
                      </td>
                      <td className="py-6 text-right font-bold text-gray-900 text-base align-top pt-7">
                        {item.price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex flex-col md:flex-row justify-end mt-12 mb-16 pt-6 border-t border-gray-100">
              <div className="w-full md:w-5/12 space-y-3">
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>Subtotal</span>
                  <span className="font-medium text-gray-900">
                    {dummyOrder.total}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>Tax (0%)</span>
                  <span className="font-medium text-gray-900">₦0.00</span>
                </div>
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>Shipping</span>
                  <span className="text-green-600 font-medium">Free</span>
                </div>

                {/* Wallet Deduction */}
                {walletDed > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 font-medium">
                      Wallet Payment
                    </span>
                    <span className="text-green-600 font-bold">
                      -₦{walletDed.toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="border-t-2 border-gray-900 pt-4 mt-4 flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">
                    Total Due
                  </span>
                  <span className="text-2xl font-extrabold text-gray-900">
                    ₦{amountDue.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Notes & Payment Link */}
            <div className="mt-auto border-t border-gray-100 pt-10 text-center">
              {/* Payment Link Message */}
              <div className="mb-8 p-4 bg-red-50/50 rounded-xl border border-red-100 inline-block">
                <p className="text-sm text-gray-800 font-medium">
                  Click on{' '}
                  <a
                    href="#"
                    className="text-red-600 underline font-bold hover:text-red-700 decoration-2 underline-offset-4"
                  >
                    this link
                  </a>{' '}
                  to complete payment.
                </p>
              </div>

              <p className="text-sm text-gray-400 italic">
                Thank you for shopping with Ogabassey!
              </p>
              <p className="text-[10px] text-gray-300 mt-8 uppercase tracking-widest">
                Generated via Ogabassey Platform
              </p>
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
