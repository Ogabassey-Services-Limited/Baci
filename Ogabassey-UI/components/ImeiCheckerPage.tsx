
import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Smartphone, Loader2, ScanBarcode, ArrowRight, ShieldCheck, Lock, Globe, Search, RefreshCw, Calendar } from 'lucide-react';

export const ImeiCheckerPage: React.FC = () => {
  const [imei, setImei] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imei.trim()) return;
    
    setIsLoading(true);
    setResult(null);

    // Mock API simulation
    setTimeout(() => {
        setIsLoading(false);
        // Mock result: if IMEI ends in 0, it's 'Blacklisted' for demo purposes
        const isClean = !imei.endsWith('0');
        
        setResult({
            imei: imei,
            device: 'iPhone 15 Pro Max 1TB - Natural Titanium',
            modelNumber: 'A2849',
            status: isClean ? 'Clean' : 'Blacklisted',
            icloud: isClean ? 'Clean' : 'Lost Mode',
            simLock: 'Unlocked',
            blacklistStatus: isClean ? 'Clean' : 'Reported Stolen',
            warranty: 'Active until Dec 20, 2024',
            purchaseDate: 'Dec 21, 2023',
            score: isClean ? 100 : 45
        });
    }, 2500);
  };

  return (
      <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1">
              
              {/* Hero & Search Section */}
              <div className="max-w-3xl mx-auto text-center mb-12">
                  <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                      <ShieldCheck size={14} /> Official Verification Tool
                  </div>
                  <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">
                      Verify Before You Buy.
                  </h1>
                  <p className="text-gray-500 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
                      Is your "Brand New" iPhone actually refurbished? <span className="text-gray-900 font-medium">Verify activation dates</span>, check warranty status, and avoid stolen devices instantly.
                  </p>

                  <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-2 md:p-3 relative z-10">
                      <form onSubmit={handleCheck} className="flex flex-col md:flex-row gap-2">
                          <div className="relative flex-1">
                              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                  <ScanBarcode className="text-gray-400" size={20} />
                              </div>
                              <input 
                                type="text" 
                                value={imei}
                                onChange={(e) => setImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                placeholder="Enter 15-digit IMEI Number" 
                                className="w-full pl-12 pr-4 py-4 bg-gray-50 hover:bg-white focus:bg-white border border-transparent focus:border-red-100 rounded-2xl focus:ring-4 focus:ring-red-500/10 outline-none text-lg font-mono tracking-widest transition-all placeholder:font-sans placeholder:tracking-normal text-gray-900"
                              />
                          </div>
                          <button 
                            disabled={isLoading || imei.length < 15}
                            type="submit"
                            className="bg-[#1a1a1a] text-white font-bold text-base px-8 py-4 rounded-2xl hover:bg-black transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg active:scale-95 whitespace-nowrap"
                          >
                            {isLoading ? <Loader2 className="animate-spin" /> : 'Run Check'}
                          </button>
                      </form>
                  </div>
                  
                  <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-700">1</span>
                          <span>Dial <strong className="text-gray-900">*#06#</strong> on your device</span>
                      </div>
                      <div className="hidden md:block w-1 h-1 bg-gray-300 rounded-full"></div>
                      <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-700">2</span>
                          <span>Copy the 15-digit number</span>
                      </div>
                  </div>
              </div>

              {/* RESULTS SECTION */}
              {result && (
                  <div className="max-w-2xl mx-auto mb-16 animate-in slide-in-from-bottom-8 duration-700">
                      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                          {/* Header */}
                          <div className={`p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${result.status === 'Clean' ? 'bg-green-50/50' : 'bg-red-50/50'}`}>
                              <div>
                                  <div className="flex items-center gap-2 mb-2">
                                      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Device Report</span>
                                      <span className="text-gray-300">•</span>
                                      <span className="text-xs font-mono text-gray-500">{new Date().toLocaleString()}</span>
                                  </div>
                                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">{result.device}</h2>
                                  <p className="text-sm text-gray-500 font-mono mt-1">IMEI: {result.imei}</p>
                              </div>
                              <div className={`px-4 py-2 rounded-xl border flex flex-col items-center justify-center min-w-[100px] ${result.status === 'Clean' ? 'bg-white border-green-100' : 'bg-white border-red-100'}`}>
                                  <span className={`text-2xl font-black ${result.status === 'Clean' ? 'text-green-600' : 'text-red-600'}`}>
                                      {result.score}%
                                  </span>
                                  <span className="text-[10px] font-bold uppercase text-gray-400">Trust Score</span>
                              </div>
                          </div>

                          {/* Status Grid */}
                          <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Blacklist Status */}
                              <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${result.blacklistStatus === 'Clean' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                      <ShieldCheck size={20} />
                                  </div>
                                  <div>
                                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Blacklist Status</p>
                                      <p className={`font-bold text-base ${result.blacklistStatus === 'Clean' ? 'text-green-700' : 'text-red-600'}`}>
                                          {result.blacklistStatus}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">GSMA Database Check</p>
                                  </div>
                              </div>

                              {/* iCloud Status */}
                              <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${result.icloud === 'Clean' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                      <Lock size={20} />
                                  </div>
                                  <div>
                                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">iCloud Lock</p>
                                      <p className={`font-bold text-base ${result.icloud === 'Clean' ? 'text-green-700' : 'text-red-600'}`}>
                                          {result.icloud === 'Clean' ? 'OFF' : 'ON (Lost Mode)'}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">Activation Lock Status</p>
                                  </div>
                              </div>

                              {/* Sim Lock */}
                              <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
                                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
                                      <Globe size={20} />
                                  </div>
                                  <div>
                                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Sim Lock</p>
                                      <p className="font-bold text-base text-gray-900">
                                          {result.simLock}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">Carrier Compatibility</p>
                                  </div>
                              </div>

                              {/* Warranty */}
                              <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
                                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-amber-50 text-amber-600">
                                      <RefreshCw size={20} />
                                  </div>
                                  <div>
                                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Warranty</p>
                                      <p className="font-bold text-base text-gray-900">
                                          {result.warranty}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">Purchase Date: {result.purchaseDate}</p>
                                  </div>
                              </div>
                          </div>

                          {/* Verdict */}
                          <div className={`p-6 border-t ${result.status === 'Clean' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'} text-center`}>
                              <h3 className={`font-bold text-lg mb-1 ${result.status === 'Clean' ? 'text-green-800' : 'text-red-800'}`}>
                                  {result.status === 'Clean' ? 'This device appears safe to buy.' : 'Do NOT purchase this device.'}
                              </h3>
                              <p className={`text-sm ${result.status === 'Clean' ? 'text-green-600' : 'text-red-600'}`}>
                                  {result.status === 'Clean' 
                                    ? "All critical checks passed. Ensure physical inspection before payment." 
                                    : "This device has been reported lost or stolen. Buying it may be illegal."}
                              </p>
                          </div>
                      </div>
                      
                      <div className="text-center mt-8">
                          <button onClick={() => setResult(null)} className="text-sm font-bold text-gray-500 hover:text-gray-900">
                              Check Another Device
                          </button>
                      </div>
                  </div>
              )}

              {/* Feature Grid (Visible when no result) */}
              {!result && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-16">
                      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
                          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                              <Calendar size={24} />
                          </div>
                          <h3 className="font-bold text-gray-900 mb-2">Check Activation Date</h3>
                          <p className="text-sm text-gray-500">If a "Brand New" phone has an activation date from months ago, it's not new. We tell you the truth.</p>
                      </div>
                      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
                          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                              <Lock size={24} />
                          </div>
                          <h3 className="font-bold text-gray-900 mb-2">Check Activation Lock</h3>
                          <p className="text-sm text-gray-500">Verify if Find My iPhone or iCloud Lock is active. Don't buy a paperweight.</p>
                      </div>
                      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
                          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                              <RefreshCw size={24} />
                          </div>
                          <h3 className="font-bold text-gray-900 mb-2">Verify Warranty</h3>
                          <p className="text-sm text-gray-500">See the original purchase date and check if the manufacturer warranty is still valid.</p>
                      </div>
                  </div>
              )}
          </div>
      </div>
  );
};
