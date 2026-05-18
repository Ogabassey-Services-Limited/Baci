import { X } from 'lucide-react';
import type React from 'react';

interface SourceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery: string;
}

export const SourceRequestModal: React.FC<SourceRequestModalProps> = ({
  isOpen,
  onClose,
  initialQuery,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>
        <h2 className="text-xl font-bold mb-4">Source Request</h2>
        <p className="mb-4">Looking for: {initialQuery}</p>
        {/* Form will go here */}
      </div>
    </div>
  );
};
