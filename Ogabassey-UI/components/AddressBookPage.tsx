import React from 'react';
import { MapPin, Plus, Edit2, Trash2, CheckCircle2 } from 'lucide-react';

export const AddressBookPage: React.FC = () => {
  const addresses = [
      { id: 1, label: "Home", address: "2 Olaide Tomori St, Ikeja", city: "Lagos", state: "Lagos", phone: "+234 814 697 8921", isDefault: true },
      { id: 2, label: "Office", address: "Tech Hub, 45 Admiralty Way, Lekki Phase 1", city: "Lagos", state: "Lagos", phone: "+234 800 123 4567", isDefault: false },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        
        <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="text-red-600 fill-red-600" />
            Address Book
            </h1>
            <button className="bg-red-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2 shadow-sm active:scale-95">
                <Plus size={16} /> Add New
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map((addr) => (
                <div key={addr.id} className={`bg-white p-6 rounded-2xl border ${addr.isDefault ? 'border-red-200 ring-1 ring-red-50' : 'border-gray-100'} shadow-sm relative group`}>
                    
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{addr.label}</span>
                            {addr.isDefault && (
                                <span className="bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-100 flex items-center gap-1">
                                    <CheckCircle2 size={10} /> Default
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                <Edit2 size={16} />
                            </button>
                            {!addr.isDefault && (
                                <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1 text-sm text-gray-600 mb-4">
                        <p>{addr.address}</p>
                        <p>{addr.city}, {addr.state}</p>
                        <p className="pt-2 font-medium text-gray-900">{addr.phone}</p>
                    </div>

                    {!addr.isDefault && (
                        <button className="text-xs font-bold text-gray-400 hover:text-red-600 transition-colors">
                            Set as Default
                        </button>
                    )}
                </div>
            ))}
        </div>

      </div>
    </div>
  );
};