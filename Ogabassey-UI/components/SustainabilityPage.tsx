
import React, { useEffect } from 'react';
import { Leaf, FileDigit, Recycle, Globe, TreePine, Wind, ArrowRight, Wrench, Battery, Cpu, BookOpen, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export const SustainabilityPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const initiatives = [
    {
      title: "Paperless Since 2020",
      desc: "In a bold move to reduce paper waste, we completely phased out physical receipts in 2020. Every transaction now generates a secure, digital invoice sent directly to your email or app.",
      icon: FileDigit,
      stat: "100k+ Sheets Saved"
    },
    {
      title: "Circular Economy",
      desc: "Our robust 'Swap & Trade-in' program ensures old devices don't end up in landfills. We refurbish and re-home pre-owned gadgets, extending their lifecycle significantly.",
      icon: Recycle,
      stat: "15k+ Devices Recycled"
    },
    {
      title: "Energy Efficiency",
      desc: "Our operations utilize energy-efficient logistics planning to minimize our carbon footprint during deliveries across Nigeria.",
      icon: Wind,
      stat: "Lower Carbon Emissions"
    }
  ];

  const sdgs = [
    {
      id: 12,
      title: "Responsible Consumption",
      desc: "By promoting the purchase of high-quality used devices (UK Used), we reduce the demand for new manufacturing resources.",
      color: "bg-[#BF8B2E]"
    },
    {
      id: 13,
      title: "Climate Action",
      desc: "Our digital-first approach significantly lowers waste and energy consumption associated with traditional retail.",
      color: "bg-[#3F7E44]"
    }
  ];

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Hero Section */}
      <div className="relative bg-[#064e3b] text-white py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/leaf.png')]"></div>
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 relative z-10 text-center">
          <span className="inline-block py-1 px-3 rounded-full bg-green-500/20 text-green-300 text-xs font-bold uppercase tracking-widest mb-6 border border-green-500/30">
            Our Green Promise
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight leading-tight">
            Tech for Good, <br className="hidden md:block" />
            <span className="text-green-400">Care for the Planet</span>
          </h1>
          <p className="text-green-100/80 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            At Ogabassey, we believe innovation shouldn't cost the earth. We are committed to sustainable practices that protect our environment for future generations.
          </p>
        </div>
        
        {/* Decorative Elements */}
        <Leaf className="absolute top-10 left-10 text-white/5 w-32 h-32 -rotate-12" />
        <Globe className="absolute bottom-10 right-10 text-white/5 w-40 h-40 rotate-12" />
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-16 md:py-24">
        
        {/* The Paperless Story */}
        <div className="bg-green-50 rounded-3xl p-8 md:p-12 mb-20 border border-green-100 flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm text-green-600">
                    <FileDigit size={32} />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Going Digital: <br/>Zero Paper Receipts</h2>
                <div className="space-y-4 text-gray-600 leading-relaxed">
                    <p>
                        <strong>Since 2020, Ogabassey has stopped issuing physical receipts.</strong> This wasn't just a cost-saving measure; it was a deliberate choice to align our operations with global sustainability standards.
                    </p>
                    <p>
                        Traditional receipts are often coated with BPA (Bisphenol A) or BPS (Bisphenol S), making them non-recyclable. By switching to 100% digital invoices, we eliminate this toxic waste, save trees, and provide you with a permanent, searchable record of your purchases.
                    </p>
                </div>
            </div>
            <div className="flex-1 w-full">
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <TreePine size={100} className="text-green-800" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-6">The Impact So Far</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-green-50 p-4 rounded-xl text-center">
                            <span className="block text-2xl font-extrabold text-green-700">4+</span>
                            <span className="text-xs text-green-600 font-medium">Years Paperless</span>
                        </div>
                        <div className="bg-green-50 p-4 rounded-xl text-center">
                            <span className="block text-2xl font-extrabold text-green-700">Zero</span>
                            <span className="text-xs text-green-600 font-medium">Thermal Paper Used</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Initiatives Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
            {initiatives.map((item, idx) => (
                <div key={idx} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mb-6 group-hover:bg-green-50 group-hover:text-green-600 transition-colors">
                        <item.icon size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed mb-6">{item.desc}</p>
                    <div className="pt-6 border-t border-gray-50">
                        <span className="text-xs font-bold text-green-600 uppercase tracking-wider">{item.stat}</span>
                    </div>
                </div>
            ))}
        </div>

        {/* Device Longevity & Education (New Section) */}
        <div className="mb-24">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Education & Maintenance</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Education Card */}
                <div className="bg-blue-50 rounded-2xl p-8 border border-blue-100 relative overflow-hidden group hover:shadow-lg transition-all">
                    <div className="relative z-10">
                        <div className="w-14 h-14 bg-white text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
                            <BookOpen size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">Device Longevity Education</h3>
                        <p className="text-gray-600 mb-6 leading-relaxed">
                            The most sustainable device is the one that lasts. We actively educate our community on how to extend battery life, protect screens, and optimize performance through our <strong>Tech Insights Blog</strong>.
                        </p>
                        <Link to="/blog" className="inline-flex items-center gap-2 font-bold text-blue-700 hover:gap-3 transition-all">
                            Read Our Tips <ArrowRight size={18} />
                        </Link>
                    </div>
                    <BookOpen className="absolute -bottom-6 -right-6 text-blue-200 opacity-50 w-40 h-40 -rotate-12 transition-transform group-hover:scale-110" />
                </div>

                {/* Maintenance Card */}
                <div className="bg-indigo-50 rounded-2xl p-8 border border-indigo-100 relative overflow-hidden group hover:shadow-lg transition-all">
                    <div className="relative z-10">
                        <div className="w-14 h-14 bg-white text-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
                            <Sparkles size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">Free Maintenance Services</h3>
                        <p className="text-gray-600 mb-6 leading-relaxed">
                            To prevent premature disposal, we offer <strong>free charging port and speaker cleaning</strong> for all walk-in customers. Simple maintenance often fixes "broken" devices, saving them from becoming e-waste.
                        </p>
                        <Link to="/repairs" className="inline-flex items-center gap-2 font-bold text-indigo-700 hover:gap-3 transition-all">
                            Visit Repair Lab <ArrowRight size={18} />
                        </Link>
                    </div>
                    <Sparkles className="absolute -bottom-6 -right-6 text-indigo-200 opacity-50 w-40 h-40 rotate-12 transition-transform group-hover:scale-110" />
                </div>

            </div>
        </div>

        {/* Repair & Recycle Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-24">
            <div className="relative h-[500px] rounded-3xl overflow-hidden shadow-2xl group order-2 lg:order-1">
                <img 
                    src="https://images.unsplash.com/photo-1581092921461-eab62e97a782?q=80&w=2000&auto=format&fit=crop" 
                    alt="Electronic Repair" 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                    <div className="absolute bottom-8 left-8 text-white">
                        <p className="font-bold text-xl mb-1">The Repair Lab</p>
                        <p className="text-sm text-gray-300">Where we give devices a second chance.</p>
                    </div>
                </div>
            </div>
            
            <div className="order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 text-orange-700 text-xs font-bold uppercase tracking-wider mb-6 border border-orange-100">
                    <Wrench size={14} /> Repair & Recycle
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-6 leading-tight">
                    Extending Lifecycles, <br/>
                    <span className="text-orange-600">Eliminating Waste.</span>
                </h2>
                <div className="space-y-6 text-gray-600 leading-relaxed">
                    <p>
                        The most sustainable device is the one you already own. Our <strong>Repair Department</strong> is dedicated to keeping your gadgets running for as long as possible, actively fighting the culture of disposable tech.
                    </p>
                    <p>
                        From battery replacements to complex motherboard microsoldering, every repair we perform prevents a device from becoming premature electronic waste in a landfill.
                    </p>
                </div>
                
                <div className="mt-8 pt-8 border-t border-gray-100 bg-gray-50 rounded-2xl p-6">
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Recycle className="text-green-600" size={18} /> What happens to the broken parts?
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                            <div className="bg-white p-2 rounded-lg border border-gray-100 text-red-500 shrink-0">
                                <Battery size={18} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-900">Safe Disposal</p>
                                <p className="text-[11px] text-gray-500 leading-tight mt-1">Hazardous li-ion batteries are neutralized by certified partners.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="bg-white p-2 rounded-lg border border-gray-100 text-blue-500 shrink-0">
                                <Cpu size={18} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-900">Harvesting</p>
                                <p className="text-[11px] text-gray-500 leading-tight mt-1">Working chips are salvaged from dead boards for future repairs.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* SDG Alignment */}
        <div className="mb-20">
            <div className="text-center max-w-2xl mx-auto mb-12">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Aligned with Global Goals</h2>
                <p className="text-gray-500">We are proud to align our business practices with the United Nations Sustainable Development Goals (SDGs).</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {sdgs.map((sdg) => (
                    <div key={sdg.id} className="flex overflow-hidden rounded-2xl shadow-sm border border-gray-100 bg-white">
                        <div className={`${sdg.color} w-24 flex items-center justify-center p-4 text-white font-black text-4xl shrink-0`}>
                            {sdg.id}
                        </div>
                        <div className="p-6">
                            <h3 className="font-bold text-gray-900 text-lg mb-2">{sdg.title}</h3>
                            <p className="text-sm text-gray-600">{sdg.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* CTA */}
        <div className="bg-[#1a1a1a] rounded-3xl p-8 md:p-16 text-center text-white relative overflow-hidden">
            <div className="relative z-10">
                <h2 className="text-3xl font-bold mb-4">Join the Green Revolution</h2>
                <p className="text-gray-400 mb-8 max-w-lg mx-auto">Make a difference with your next upgrade. Trade in your old device or buy a certified UK Used gadget today.</p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Link to="/swap" className="bg-green-600 text-white font-bold py-3.5 px-8 rounded-xl hover:bg-green-700 transition-colors shadow-lg active:scale-95 flex items-center justify-center gap-2">
                        <Recycle size={20} /> Trade-in Device
                    </Link>
                    <Link to="/" className="bg-white text-gray-900 font-bold py-3.5 px-8 rounded-xl hover:bg-gray-100 transition-colors shadow-lg active:scale-95">
                        Shop Sustainable
                    </Link>
                </div>
            </div>
            
            {/* Abstract Pattern */}
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
        </div>

      </div>
    </div>
  );
};
