'use client';

import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

interface WalletContextType {
  earningsBalance: number;
  deductEarnings: (amount: number) => boolean;
  addEarnings: (amount: number) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const V2WalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Persist wallet balance? For demo/template, maybe just state or local storage.
  const [earningsBalance, setEarningsBalance] = useState(50000); // Mock starting balance

  useEffect(() => {
    const saved = localStorage.getItem('ogabassey_v2_wallet');
    if (saved) {
      setEarningsBalance(Number(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ogabassey_v2_wallet', earningsBalance.toString());
  }, [earningsBalance]);

  const deductEarnings = (amount: number) => {
    if (earningsBalance >= amount) {
      setEarningsBalance((prev) => prev - amount);
      return true;
    }
    return false;
  };

  const addEarnings = (amount: number) => {
    setEarningsBalance((prev) => prev + amount);
  };

  return (
    <WalletContext.Provider
      value={{ earningsBalance, deductEarnings, addEarnings }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useV2Wallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useV2Wallet must be used within a V2WalletProvider');
  }
  return context;
};
