'use client';

import {
  generateReceiptHtml,
  type ReceiptMerchant,
  type ReceiptOrder,
} from '@baci/shared';
import { Printer, X } from 'lucide-react';
import type React from 'react';
import { useRef } from 'react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: ReceiptOrder | null;
  merchantData: ReceiptMerchant | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  orderData,
  merchantData,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  if (!isOpen || !orderData || !merchantData) return null;

  const isPaid = orderData.payment_status === 'paid';
  const documentTitle = isPaid ? 'Receipt' : 'Invoice';

  const html = generateReceiptHtml(orderData, merchantData);

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* biome-ignore lint/a11y/useKeyboardEventHandler: click overlay to close */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      />

      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl relative z-10 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header Actions */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl shrink-0">
          <h3 className="font-bold text-gray-900">{documentTitle} Details</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              title="Print or save as PDF"
              aria-label="Print receipt"
            >
              <Printer size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              aria-label="Close receipt"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Shared HTML Receipt via iframe */}
        <div className="flex-1 overflow-hidden bg-gray-50">
          <iframe
            ref={iframeRef}
            srcDoc={html}
            title={`${documentTitle} #${orderData.order_number}`}
            className="w-full h-full border-0"
            style={{ minHeight: '500px' }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
};
