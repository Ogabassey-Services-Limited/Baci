'use client';

import { Gift, Send } from 'lucide-react';
import type React from 'react';
import { SUGGESTIONS } from './types';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  isSanta: boolean;
  showSuggestions: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onSuggestionClick: (label: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  isLoading,
  isSanta,
  showSuggestions,
  onSubmit,
  onSuggestionClick,
}) => {
  return (
    <form
      onSubmit={onSubmit}
      className={`p-4 border-t ${isSanta ? 'bg-[#FFF5F5] border-red-100' : 'bg-white border-gray-100'}`}
    >
      {showSuggestions && (
        <div className="flex gap-2 overflow-x-auto pb-3 pt-1 hide-scrollbar">
          {SUGGESTIONS.map((s, i) => (
            <button
              type="button"
              key={i}
              onClick={() => onSuggestionClick(s.label)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-red-50 hover:text-red-600 hover:border-red-100 border border-gray-200 rounded-full text-xs font-medium text-gray-600 transition-colors whitespace-nowrap shrink-0"
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isSanta ? "Tell Santa your wish..." : "Type your message..."}
          className={`flex-1 px-4 py-2.5 rounded-full border focus:outline-hidden focus:ring-2 focus:ring-offset-1 transition-all text-sm ${isSanta
            ? 'border-red-200 focus:border-red-400 focus:ring-red-100 bg-white placeholder:text-red-300'
            : 'border-gray-200 focus:border-red-600 focus:ring-red-50'
          }`}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className={`p-2.5 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm flex items-center justify-center w-10 h-10 ${isSanta
            ? 'bg-red-600 hover:bg-red-700 hover:scale-105 active:scale-95'
            : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {isSanta ? <Gift size={18} /> : <Send size={18} />}
        </button>
      </div>
    </form>
  );
};
