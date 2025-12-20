
import React from 'react';
import { X, Download, Printer, Share2, Copy, AlertCircle, CheckCircle2, Leaf } from 'lucide-react';
import { Logo } from './Logo';
import { Product } from '../types';

export interface ReceiptData {
  id: string;
  date: string;
  time: string;
  total: string;
  items: number;
  product: Product;
  status: string; // Display status text
  method: string;
  
  // New Fields for enhanced receipt states
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid';
  amountPaid?: string;
  balance?: string;

  // Custom Feeds
  customerName?: string;
  address?: string;
  imei?: string;
  serial?: string;
  color?: string;
  storage?: string;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ReceiptData | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, data }) => {
  if (!isOpen || !data) return null;

  // Determine Title based on payment status
  const documentTitle = data.paymentStatus === 'unpaid' ? 'Invoice' : 'Receipt';

  // Helper to render watermark
  const renderWatermark = () => {
    const status = data.paymentStatus;
    let text = '';
    let colorClass = '';
    
    if (status === 'unpaid') { text = 'UNPAID'; colorClass = 'text-red-500/10 border-red-500/20'; }
    else if (status === 'partially_paid') { text = 'PARTIALLY PAID'; colorClass = 'text-yellow-500/10 border-yellow-500/20'; }
    else { text = 'PAID'; colorClass = 'text-green-500/10 border-green-500/20'; }

    return (
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[30deg] border-[6px] border-dashed rounded-xl px-4 py-2 text-5xl md:text-7xl font-black uppercase pointer-events-none whitespace-nowrap z-0 select-none ${colorClass}`}>
            {text}
        </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl relative z-10 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header Actions */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
           <h3 className="font-bold text-gray-900">{documentTitle} Details</h3>
           <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors" title="Print">
                 <Printer size={18} />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors" title="Download PDF">
                 <Download size={18} />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                 <X size={20} />
              </button>
           </div>
        </div>

        {/* Receipt Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50 relative">
           <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 md:p-8 relative overflow-hidden">
              {/* Decorative Top Border */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-[url('https://www.transparenttextures.com/patterns/diagonal-striped-brick.png')] bg-red-600"></div>

              {/* Watermark Overlay */}
              {renderWatermark()}

              {/* Header */}
              <div className="flex justify-between items-start mb-8 mt-2 relative z-10">
                 <Logo className="h-6 w-auto text-gray-900" />
                 <div className="text-right">
                    <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${data.paymentStatus === 'unpaid' ? 'text-red-600' : 'text-gray-400'}`}>
                        {documentTitle}
                    </p>
                    <p className="text-sm font-bold text-gray-900">#{data.id}</p>
                 </div>
              </div>

              {/* Amount Display */}
              <div className="text-center mb-8 pb-8 border-b border-dashed border-gray-200 relative z-10">
                 <p className="text-gray-500 text-xs mb-1">
                    {data.paymentStatus === 'unpaid' ? 'Total to Pay' : 'Total Amount'}
                 </p>
                 <h1 className={`text-3xl font-extrabold ${data.paymentStatus === 'unpaid' ? 'text-red-600' : 'text-gray-900'}`}>
                    {data.total}
                 </h1>
                 <p className="text-xs text-gray-400 mt-2">{data.date} • {data.time}</p>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-8 mb-8 text-sm relative z-10">
                 <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Billed To</p>
                    <p className="font-bold text-gray-900">{data.customerName || 'Alex Doe'}</p>
                    <p className="text-gray-500 text-xs mt-1 leading-relaxed">{data.address || '2 Olaide Tomori St, Ikeja, Lagos'}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Payment Method</p>
                    <p className="font-bold text-gray-900">{data.method}</p>
                    <p className="text-gray-500 text-xs mt-1">
                        {data.paymentStatus === 'unpaid' ? 'Pending' : 'Verified'}
                    </p>
                 </div>
              </div>

              {/* Line Items */}
              <div className="mb-8 relative z-10">
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Product Details</p>
                 <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                       <div>
                          <p className="font-bold text-sm text-gray-900">{data.product.name}</p>
                          <p className="text-xs text-gray-500">Qty: {data.items}</p>
                       </div>
                       <p className="font-bold text-sm text-gray-900">{data.product.price}</p>
                    </div>
                    {/* Customizable Feeds */}
                    <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-x-6 gap-y-2">
                        {data.imei && (
                            <div className="text-xs flex items-center gap-1 group cursor-pointer">
                                <span className="text-gray-400">IMEI:</span> 
                                <span className="text-gray-900 font-mono font-medium">{data.imei}</span>
                            </div>
                        )}
                         {data.color && (
                            <div className="text-xs">
                                <span className="text-gray-400">Color:</span> <span className="text-gray-700 font-medium">{data.color}</span>
                            </div>
                        )}
                    </div>
                 </div>
              </div>

              {/* Payment Breakdown (For Partial/Unpaid) */}
              {(data.paymentStatus === 'partially_paid' || data.paymentStatus === 'unpaid') && (
                  <div className="mb-8 relative z-10">
                      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
                          <div className="flex justify-between items-center mb-2 text-sm">
                              <span className="text-gray-600">Subtotal</span>
                              <span className="font-bold text-gray-900">{data.total}</span>
                          </div>
                          {data.amountPaid && (
                              <div className="flex justify-between items-center mb-2 text-sm">
                                  <span className="text-green-600 font-medium flex items-center gap-1">
                                      <CheckCircle2 size={12} /> Paid
                                  </span>
                                  <span className="font-bold text-green-600">{data.amountPaid}</span>
                              </div>
                          )}
                          <div className="border-t border-dashed border-yellow-200 my-2"></div>
                          <div className="flex justify-between items-center text-sm">
                              <span className="text-red-600 font-bold">Balance Due</span>
                              <span className="font-bold text-red-600 text-lg">{data.balance || data.total}</span>
                          </div>
                      </div>
                  </div>
              )}

              {/* Footer */}
              <div className="text-center relative z-10">
                 <p className="text-[10px] text-gray-400 mb-2">Questions regarding this {documentTitle.toLowerCase()}?</p>
                 <p className="text-xs font-bold text-red-600">support@ogabassey.com • +234 814 697 8921</p>
                 
                 <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-green-600 font-medium bg-green-50 py-1.5 rounded-lg border border-green-100">
                    <Leaf size={10} /> 
                    <span>Paperless Transaction - Thank you for saving trees!</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Sticky Action Button (For Unpaid/Partial) */}
        {data.paymentStatus !== 'paid' && (
            <div className="p-4 border-t border-gray-100 bg-white rounded-b-2xl">
                <button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-red-200 transition-all active:scale-95">
                    Pay Now {data.balance ? `(${data.balance})` : `(${data.total})`}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};
