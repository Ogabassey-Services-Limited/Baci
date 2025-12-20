
import React, { useState } from 'react';
import { FileText, Download, Search, CheckCircle2, ChevronRight, CreditCard, ExternalLink, X, AlertCircle, Clock, Leaf } from 'lucide-react';
import { products } from '../data/products';
import { ReceiptModal, ReceiptData } from './ReceiptModal';
import { EmptyState } from './EmptyState';

export const ReceiptsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Mock receipts showcasing the 3 requested versions
  const receipts: ReceiptData[] = [
      { 
        id: "OG-2024-001", 
        date: "May 20, 2024", 
        time: "10:23 AM",
        total: "₦601,200", 
        items: 1, 
        product: products[0],
        status: "Unpaid",
        method: "Bank Transfer",
        customerName: "Peter Simon",
        address: "123 Mockingbird Lane, Anytown",
        imei: "3728402723017639",
        paymentStatus: 'unpaid',
        balance: "₦601,200"
      },
      { 
        id: "OG-2024-002", 
        date: "May 20, 2024", 
        time: "1:45 PM",
        total: "₦601,200", 
        items: 1, 
        product: products[0],
        status: "Partially Paid",
        method: "Card",
        customerName: "Peter Simon",
        address: "123 Mockingbird Lane, Anytown",
        imei: "3728402723017639",
        paymentStatus: 'partially_paid',
        amountPaid: "₦301,200",
        balance: "₦300,000"
      },
      { 
        id: "OG-2024-003", 
        date: "May 20, 2024", 
        time: "06:12 PM",
        total: "₦641,200", 
        items: 1, 
        product: products[0],
        status: "Paid",
        method: "Wallet",
        customerName: "Peter Simon",
        address: "123 Mockingbird Lane, Anytown",
        imei: "3728402723017639",
        paymentStatus: 'paid'
      },
  ];

  // Search Logic
  const filteredReceipts = receipts.filter(receipt => {
      const query = searchQuery.toLowerCase();
      return (
          receipt.id.toLowerCase().includes(query) ||
          receipt.product.name.toLowerCase().includes(query) ||
          receipt.status.toLowerCase().includes(query)
      );
  });

  const handleViewReceipt = (receipt: ReceiptData) => {
      setSelectedReceipt(receipt);
      setIsModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'Paid': return <span className="bg-green-50 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-100 flex items-center gap-1 w-fit"><CheckCircle2 size={12} /> Paid</span>;
          case 'Partially Paid': return <span className="bg-yellow-50 text-yellow-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-yellow-100 flex items-center gap-1 w-fit"><Clock size={12} /> Partial</span>;
          default: return <span className="bg-red-50 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-100 flex items-center gap-1 w-fit"><AlertCircle size={12} /> Unpaid</span>;
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="text-red-600 fill-red-600" />
                Receipts & Invoices
            </h1>
            
            <div className="relative w-full md:w-96">
                <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search ID, Product or Status..." 
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

        {/* Sustainability Banner */}
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-8 flex items-center gap-3">
            <div className="p-2 bg-white text-green-600 rounded-lg shrink-0 border border-green-100">
                <Leaf size={18} />
            </div>
            <div>
                <p className="text-xs font-bold text-green-800 uppercase tracking-wide mb-0.5">100% Paperless</p>
                <p className="text-sm text-green-700">By using digital receipts, you've helped us save over 100k sheets of paper this year.</p>
            </div>
        </div>

        {filteredReceipts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
                <EmptyState 
                    title="No receipts found" 
                    description={searchQuery ? `No results found for "${searchQuery}"` : "You have no transaction receipts yet."}
                    variant="generic"
                    compact
                />
            </div>
        ) : (
            <div className="space-y-4">
                {filteredReceipts.map((receipt) => (
                    <div key={receipt.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
                        <div className="p-5 md:p-6 flex flex-col md:flex-row gap-6 md:items-center">
                            
                            {/* Product Image */}
                            <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-50 rounded-xl p-2 shrink-0 border border-gray-100 flex items-center justify-center">
                                <img src={receipt.product.image} alt={receipt.product.name} className="w-full h-full object-contain mix-blend-multiply" />
                            </div>

                            {/* Info Grid */}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                                
                                {/* Column 1: Order Details */}
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        {getStatusBadge(receipt.status)}
                                        <span className="text-xs text-gray-400">•</span>
                                        <span className="text-xs text-gray-500 font-medium">{receipt.date}</span>
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-sm md:text-base mb-0.5">#{receipt.id}</h3>
                                    <p className="text-xs text-gray-500 truncate">{receipt.product.name}</p>
                                </div>

                                {/* Column 2: Payment */}
                                <div className="flex flex-col justify-center">
                                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                                        {receipt.paymentStatus === 'unpaid' ? 'Total Due' : 'Total Amount'}
                                    </span>
                                    <span className={`font-bold text-lg ${receipt.paymentStatus === 'unpaid' ? 'text-red-600' : 'text-gray-900'}`}>
                                        {receipt.total}
                                    </span>
                                    {receipt.paymentStatus === 'partially_paid' && (
                                        <span className="text-xs text-red-500 font-medium">Bal: {receipt.balance}</span>
                                    )}
                                </div>

                                {/* Column 3: Actions */}
                                <div className="flex items-center justify-start md:justify-end gap-3 md:border-l md:border-gray-50 md:pl-6">
                                    <button 
                                        onClick={() => handleViewReceipt(receipt)}
                                        className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-red-600 hover:bg-red-50 py-2.5 px-4 rounded-xl transition-colors border border-gray-200 hover:border-red-100 group/btn"
                                    >
                                        <ExternalLink size={14} className="group-hover/btn:scale-110 transition-transform" />
                                        View {receipt.paymentStatus === 'unpaid' ? 'Invoice' : 'Receipt'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}

      </div>

      <ReceiptModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        data={selectedReceipt} 
      />
    </div>
  );
};
