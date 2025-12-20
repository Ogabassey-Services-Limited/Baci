import React, { useState, useRef, useEffect } from 'react';
import { X, Send, User, Loader2, Headphones, Sparkles, ChevronRight, ShoppingBag, Truck, Zap } from 'lucide-react';
import { chatWithGemini, ChatMessage } from '../services/geminiService';
import { useCart } from '../contexts/CartContext';
import { useTheme } from '../contexts/ThemeContext';

const SUGGESTIONS = [
  { label: "Track my order", icon: <Truck size={14} className="text-red-600" /> },
  { label: "Best gaming phones", icon: <Zap size={14} className="text-red-600" /> },
  { label: "Return policy", icon: <ShoppingBag size={14} className="text-red-600" /> },
  { label: "Contact support", icon: <Headphones size={14} className="text-red-600" /> },
];

const SantaIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Hat Back */}
    <path d="M48 20C48 20 54 36 32 36C32 36 18 36 16 20C16 20 20 4 32 4C44 4 48 20 48 20Z" fill="#DC2626"/>
    {/* Hat Tip Falling */}
    <path d="M46 12C46 12 58 16 60 28" stroke="#DC2626" strokeWidth="6" strokeLinecap="round"/>
    <circle cx="60" cy="28" r="4" fill="white"/>
    
    {/* Face */}
    <path d="M20 24C20 24 20 40 32 40C44 40 44 24 44 24" fill="#FEE2E2"/>
    
    {/* Beard - Fluffy Cloud Shape */}
    <path d="M14 30C12 30 10 32 10 35C10 38 12 40 14 40C14 44 16 48 22 52C26 55 32 56 32 56C32 56 38 55 42 52C48 48 50 44 50 40C52 40 54 38 54 35C54 32 52 30 50 30" fill="white" stroke="#E5E7EB" strokeWidth="1"/>
    
    {/* Mouth */}
    <path d="M28 44C28 44 32 46 36 44" stroke="#1F2937" strokeWidth="1" strokeLinecap="round"/>
    
    {/* Moustache */}
    <path d="M32 40C32 40 28 42 24 40C24 40 26 36 32 38C38 36 40 40 40 40C36 42 32 40 32 40Z" fill="white" stroke="#E5E7EB" strokeWidth="0.5"/>
    
    {/* Nose */}
    <circle cx="32" cy="36" r="3" fill="#FCA5A5"/>
    
    {/* Eyes */}
    <circle cx="26" cy="30" r="1.5" fill="#1F2937"/>
    <circle cx="38" cy="30" r="1.5" fill="#1F2937"/>
    
    {/* Hat Brim */}
    <path d="M14 20C14 20 14 26 32 26C50 26 50 20 50 20C50 20 50 14 32 14C14 14 14 20 14 20Z" fill="white"/>
  </svg>
);

export const ChatWidget: React.FC = () => {
  const { isCartOpen } = useCart();
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial message logic
  useEffect(() => {
    if (messages.length === 0) {
        if (theme === 'santa') {
            setMessages([{ role: 'model', text: 'Ho Ho Ho! 🎅\nWelcome to the Ogabassey Festive Shop!\n\nI\'m Santa AI. Looking for the perfect gift or need help with your order?' }]);
        } else {
            setMessages([{ role: 'model', text: 'Hello! 👋\nI\'m the Ogabassey AI Assistant.\n\nI can help you find products, track orders, or answer questions about our services. What can I do for you today?' }]);
        }
    }
  }, [theme]); // Only run if theme changes and messages are empty (or we can reset logic if needed)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage = text.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const aiResponseText = await chatWithGemini(messages, userMessage);
      setMessages(prev => [...prev, { role: 'model', text: aiResponseText }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "I'm having a little trouble connecting. Please try again or contact support." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const isSanta = theme === 'santa';

  return (
    <div className={`fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[100] font-sans flex flex-col items-end gap-4 transition-all duration-300 ${isCartOpen ? 'opacity-0 pointer-events-none translate-y-4' : 'opacity-100 translate-y-0'}`}>
      
      {/* Chat Window */}
      {isOpen && (
        <div className={`w-[calc(100vw-32px)] md:w-[400px] h-[calc(100vh-120px)] md:h-[600px] max-h-[calc(100vh-120px)] md:max-h-[600px] bg-white rounded-2xl shadow-2xl border ${isSanta ? 'border-red-200' : 'border-gray-200'} overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 fade-in duration-300 origin-bottom-right ring-1 ring-black/5`}>
          
          {/* Header */}
          <div className={`${isSanta ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'} border-b p-4 flex items-center justify-between shrink-0 relative`}>
            <div className="flex items-center gap-3 relative z-10">
              <div className="relative">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${isSanta ? 'bg-white border-red-200' : 'bg-red-50 border-red-100'}`}>
                   {isSanta ? <SantaIcon className="w-8 h-8" /> : <Sparkles size={18} className="text-red-600" />}
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-[15px] flex items-center gap-2">
                  {isSanta ? 'Santa AI' : 'Ogabassey AI'}
                  <span className={`${isSanta ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} text-[10px] px-2 py-0.5 rounded-full font-medium border border-transparent`}>
                    {isSanta ? 'Festive' : 'Beta'}
                  </span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Always here to help</p>
              </div>
            </div>
            <div className="flex items-center gap-1 relative z-10">
               <button 
                onClick={() => setIsOpen(false)} 
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
               >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#F8F9FA] scroll-smooth relative">
            {/* Background decoration for Santa theme */}
            {isSanta && (
                <div className="absolute inset-0 pointer-events-none opacity-5 bg-[url('https://www.transparenttextures.com/patterns/snow.png')]"></div>
            )}

            <div className="space-y-6 relative z-10">
              <div className="text-center">
                 <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">Today</span>
              </div>

              {messages.map((msg, idx) => (
                <div key={idx} className={`flex items-end gap-2 group ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-gray-200 text-gray-600 hidden' : 'bg-white border border-gray-100 text-red-600'}`}>
                    {msg.role === 'user' ? <User size={14} className="text-red-600" /> : (isSanta ? <SantaIcon className="w-6 h-6" /> : <Sparkles size={14} />)}
                  </div>

                  {/* Bubble */}
                  <div className="flex flex-col gap-1 max-w-[85%]">
                     <span className={`text-[10px] text-gray-400 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                       {msg.role === 'user' ? 'You' : (isSanta ? 'Santa AI' : 'Ogabassey AI')}
                     </span>
                     <div 
                        className={`px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-sm whitespace-pre-wrap ${
                        msg.role === 'user' 
                            ? 'bg-red-600 text-white rounded-tr-none shadow-red-100' 
                            : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                        }`}
                    >
                        {msg.text}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                 <div className="flex items-end gap-2">
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-100 text-red-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                       {isSanta ? <SantaIcon className="w-6 h-6" /> : <Sparkles size={14} />}
                    </div>
                    <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                       <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                       <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                       <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                 </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Footer Area */}
          <div className="bg-white border-t border-gray-100 p-4 pt-2">
             
             {/* Suggestion Chips */}
             {messages.length < 3 && !isLoading && (
                <div className="flex gap-2 overflow-x-auto pb-3 pt-1 hide-scrollbar">
                   {SUGGESTIONS.map((s, i) => (
                      <button 
                        key={i}
                        onClick={() => handleSend(s.label)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-red-50 hover:text-red-600 hover:border-red-100 border border-gray-200 rounded-full text-xs font-medium text-gray-600 transition-colors whitespace-nowrap shrink-0"
                      >
                         {s.icon} {s.label}
                      </button>
                   ))}
                </div>
             )}

             {/* Human Handoff Button */}
             <button className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 py-2 rounded-lg transition-colors mb-2 group">
                <Headphones size={14} className="text-red-600 group-hover:scale-110 transition-transform" />
                Connect with Human Support
             </button>

             {/* Input Bar */}
             <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question..."
                  className="w-full bg-gray-100 text-gray-900 placeholder-gray-500 rounded-full pl-5 pr-12 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white border border-transparent focus:border-red-100 transition-all shadow-inner"
                />
                <button 
                  type="submit" 
                  disabled={!input.trim() || isLoading}
                  className="absolute right-1.5 top-1.5 w-9 h-9 bg-red-600 text-white rounded-full flex items-center justify-center hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:shadow-none cursor-pointer transition-all"
                >
                  <Send size={16} className={input.trim() ? "translate-x-0.5" : ""} />
                </button>
             </form>
             <div className="text-center mt-2">
                <p className="text-[10px] text-gray-300">Powered by Google Gemini • AI can make mistakes.</p>
             </div>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 md:w-16 md:h-16 rounded-full shadow-xl border border-gray-100 flex items-center justify-center transition-all duration-500 hover:scale-110 group relative ${isOpen ? 'bg-gray-900 text-white rotate-90' : 'bg-white/60 backdrop-blur-md text-red-600 hover:bg-white hover:border-red-100'}`}
      >
        {isOpen ? (
            <X size={28} />
        ) : (
            <>
                {isSanta ? <SantaIcon className="w-8 h-8 drop-shadow-sm" /> : <Sparkles size={28} className="md:w-8 md:h-8 drop-shadow-sm" fill="currentColor" fillOpacity={0.1} />}
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 text-[9px] font-bold text-white items-center justify-center shadow-sm border border-white">AI</span>
                </span>
            </>
        )}
      </button>
    </div>
  );
};