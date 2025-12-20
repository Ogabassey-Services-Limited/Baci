
import React, { useEffect } from 'react';
import { Wrench, Smartphone, Laptop, Battery, Monitor, ChevronRight, ShieldCheck, Sparkles, Recycle, Leaf, HeartPulse, Zap, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const RepairsPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const services = [
    { title: "Screen Renewal", price: "From ₦25,000", icon: Monitor, desc: "Don't let a crack end its life." },
    { title: "Battery Boost", price: "From ₦15,000", icon: Battery, desc: "Restore all-day power." },
    { title: "Port Restoration", price: "From ₦12,000", icon: Smartphone, desc: "Fix charging connection issues." },
    { title: "System Revive", price: "From ₦10,000", icon: Laptop, desc: "Software fixes & optimization." },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
             <div className="bg-red-100 p-2 rounded-lg text-red-700">
                 <Wrench size={24} />
             </div>
             <h1 className="text-2xl font-bold text-gray-900">Repair Lab</h1>
        </div>
        <p className="text-gray-500 text-sm mb-8 max-w-xl">
            Extend the life of your devices. Expert repairs that save you money and help the planet.
        </p>

        {/* Hero Card - Brand Focused */}
        <div className="bg-[#1a1a1a] text-white rounded-3xl p-8 md:p-12 mb-12 relative overflow-hidden shadow-xl">
            <div className="relative z-10 max-w-lg">
                <span className="inline-flex items-center gap-1.5 bg-red-600/20 backdrop-blur-md border border-red-600/30 text-red-400 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
                    <Sparkles size={12} /> Premium Service
                </span>
                <h2 className="text-3xl md:text-5xl font-extrabold mb-4 leading-tight">
                    Don't Ditch It. <br/><span className="text-red-600">Fix It.</span>
                </h2>
                <p className="text-gray-400 mb-8 text-sm md:text-base leading-relaxed">
                    Every device repaired is one less in a landfill. Our certified technicians use genuine parts to give your gadget a second life.
                </p>
                <div className="flex flex-wrap gap-4">
                    <button className="bg-red-600 text-white font-bold py-3.5 px-8 rounded-xl hover:bg-red-700 transition-colors shadow-lg active:scale-95 shadow-red-900/20">
                        Book a Repair
                    </button>
                    <Link to="/swap" className="bg-white/10 text-white border border-white/20 font-bold py-3.5 px-8 rounded-xl hover:bg-white/20 transition-colors active:scale-95 backdrop-blur-sm">
                        Trade-in Instead
                    </Link>
                </div>
            </div>
            
            {/* Abstract Tech Pattern */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/circuit.png')]"></div>
            
            {/* Red Glow Effect */}
            <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-red-600 rounded-full blur-[120px] opacity-20"></div>
        </div>

        {/* The Repair Impact */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center group hover:-translate-y-1 transition-transform">
                <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <HeartPulse size={28} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Extend Lifespan</h3>
                <p className="text-sm text-gray-500">Reparing adds 2-3 years to your device's life, saving you the cost of a new phone.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center group hover:-translate-y-1 transition-transform">
                <div className="w-14 h-14 bg-gray-100 text-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Leaf size={28} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Reduce E-Waste</h3>
                <p className="text-sm text-gray-500">Electronic waste is toxic. Repairing keeps hazardous materials out of the soil.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center group hover:-translate-y-1 transition-transform">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <ShieldCheck size={28} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Data Safety</h3>
                <p className="text-sm text-gray-500">Keep your photos and files. Transferring data to a new device is risky; keeping yours is safe.</p>
            </div>
        </div>

        {/* Services Grid */}
        <h3 className="font-bold text-xl text-gray-900 mb-6 flex items-center gap-2">
            <Wrench className="text-red-600" size={20} /> Restoration Services
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
            {services.map((service, idx) => (
                <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 hover:border-red-200 hover:shadow-md transition-all group cursor-pointer relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity text-red-500">
                        <Zap size={40} className="opacity-10" />
                    </div>
                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-red-50 group-hover:text-red-600 transition-colors">
                        <service.icon size={24} />
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">{service.title}</h4>
                    <p className="text-xs text-gray-500 mb-4 h-8">{service.desc}</p>
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                        <span className="text-sm font-bold text-red-600">{service.price}</span>
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-red-600" />
                    </div>
                </div>
            ))}
        </div>

        {/* Maintenance Banner */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 md:p-10 relative overflow-hidden mb-16 shadow-sm">
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-600 shrink-0 border border-red-100">
                    <Sparkles size={40} />
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h3 className="text-2xl font-bold mb-2 text-gray-900">Preventative Care is Free</h3>
                    <p className="text-gray-600 text-sm md:text-base max-w-2xl leading-relaxed">
                        Often, a "broken" charging port is just dirty. Visit us for a <strong>free cleaning service</strong>. We'll clear out dust and lint from your speakers and ports to restore performance instantly.
                    </p>
                </div>
                <div className="shrink-0">
                    <button className="bg-gray-900 text-white font-bold py-3 px-6 rounded-xl hover:bg-black transition-colors shadow-lg active:scale-95">
                        Visit Store
                    </button>
                </div>
            </div>
        </div>

        {/* Recycling Section - Neutral Tones */}
        <div className="bg-gray-100 rounded-3xl p-8 md:p-12 text-center border border-gray-200">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-6 text-gray-700 shadow-sm">
                <Recycle size={32} />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Beyond Repair? Recycle Responsibly.</h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-8">
                If your device is truly at the end of its life, don't throw it in the trash. Electronic waste contains harmful chemicals. Drop it off at any Ogabassey location, and we will ensure it is stripped for parts and recycled safely.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="bg-white p-4 rounded-xl flex items-center gap-3 shadow-sm text-left border border-gray-100">
                    <div className="bg-red-50 text-red-500 p-2 rounded-lg"><AlertTriangle size={20} /></div>
                    <div>
                        <p className="font-bold text-gray-900 text-sm">Safe Disposal</p>
                        <p className="text-xs text-gray-500">of Lithium Batteries</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl flex items-center gap-3 shadow-sm text-left border border-gray-100">
                    <div className="bg-gray-100 text-gray-600 p-2 rounded-lg"><Monitor size={20} /></div>
                    <div>
                        <p className="font-bold text-gray-900 text-sm">Glass Recycling</p>
                        <p className="text-xs text-gray-500">Screens processed correctly</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl flex items-center gap-3 shadow-sm text-left border border-gray-100">
                    <div className="bg-blue-50 text-blue-600 p-2 rounded-lg"><Smartphone size={20} /></div>
                    <div>
                        <p className="font-bold text-gray-900 text-sm">Component Harvest</p>
                        <p className="text-xs text-gray-500">Chips reused for repairs</p>
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};
