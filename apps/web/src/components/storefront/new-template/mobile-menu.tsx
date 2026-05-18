import { X } from 'lucide-react';
import type React from 'react';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-white">
      <div className="p-4 flex justify-between items-center border-b">
        <span className="font-bold text-lg">Menu</span>
        <button type="button" onClick={onClose} aria-label="Close menu">
          <X size={24} />
        </button>
      </div>
      <div className="p-4">
        {/* Menu items will go here */}
        <p>Mobile Menu Content</p>
      </div>
    </div>
  );
};
