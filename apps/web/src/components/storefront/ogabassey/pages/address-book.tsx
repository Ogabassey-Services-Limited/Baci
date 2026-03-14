'use client';

import { CheckCircle2, Edit2, MapPin, Plus, Trash2 } from 'lucide-react';
import type React from 'react';
import { EmptyState } from '../components/empty-state';
import { type SavedAddress } from '@/contexts/customer-auth-context';

export interface AddressBookProps {
  addresses: SavedAddress[];
  onAdd: () => void;
  onEdit: (address: SavedAddress) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

export const OgabasseyV2AddressBook: React.FC<AddressBookProps> = ({
  addresses,
  onAdd,
  onEdit,
  onDelete,
  onSetDefault,
}) => {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="text-red-600 fill-red-600" />
            Address Book
          </h1>
          <button
            type="button"
            onClick={onAdd}
            className="bg-red-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2 shadow-sm active:scale-95"
          >
            <Plus size={16} /> Add New
          </button>
        </div>

        {addresses.length === 0 ? (
          <EmptyState
            variant="address"
            title="No Addresses Found"
            description="You haven't added any shipping addresses yet."
            actionLabel="Add New Address"
            onAction={onAdd}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className={`bg-white p-6 rounded-2xl border ${addr.is_default ? 'border-red-200 ring-1 ring-red-50' : 'border-gray-100'} shadow-sm relative group`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{addr.label}</span>
                    {addr.is_default && (
                      <span className="bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-100 flex items-center gap-1">
                        <CheckCircle2 size={10} /> Default
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => onEdit(addr)}
                      aria-label={`Edit ${addr.label} address`}
                      title={`Edit ${addr.label} address`}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    {!addr.is_default && (
                      <button
                        type="button"
                        onClick={() => onDelete(addr.id)}
                        aria-label={`Delete ${addr.label} address`}
                        title={`Delete ${addr.label} address`}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1 text-sm text-gray-600 mb-4">
                  <p>{addr.address}</p>
                  <p>
                    {addr.city}, {addr.state}
                  </p>
                  <p className="pt-2 font-medium text-gray-900">{addr.phone}</p>
                </div>

                {!addr.is_default && (
                  <button
                    type="button"
                    onClick={() => onSetDefault(addr.id)}
                    className="text-xs font-bold text-gray-400 hover:text-red-600 transition-colors"
                  >
                    Set as Default
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
