'use client';

import type React from 'react';
import { createContext, useContext, useSyncExternalStore } from 'react';

interface WalletContextType {
  earningsBalance: number;
  deductEarnings: (amount: number) => boolean;
  addEarnings: (amount: number) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const WALLET_STORAGE_KEY = 'ogabassey_v2_wallet';
// Mock starting balance for the demo/template wallet.
const DEFAULT_EARNINGS_BALANCE = 50000;

let walletListeners: ReadonlyArray<() => void> = [];

function subscribeToWallet(listener: () => void) {
  walletListeners = [...walletListeners, listener];
  return () => {
    walletListeners = walletListeners.filter((entry) => entry !== listener);
  };
}

function readWalletBalance(): number {
  const saved = localStorage.getItem(WALLET_STORAGE_KEY);
  return saved ? Number(saved) : DEFAULT_EARNINGS_BALANCE;
}

function getServerWalletBalance(): number {
  return DEFAULT_EARNINGS_BALANCE;
}

function writeWalletBalance(next: number) {
  localStorage.setItem(WALLET_STORAGE_KEY, next.toString());
  for (const listener of walletListeners) {
    listener();
  }
}

function deductEarnings(amount: number): boolean {
  const balance = readWalletBalance();
  if (balance >= amount) {
    writeWalletBalance(balance - amount);
    return true;
  }
  return false;
}

function addEarnings(amount: number) {
  writeWalletBalance(readWalletBalance() + amount);
}

export const V2WalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // localStorage is an external store, so read it through
  // useSyncExternalStore instead of mirroring it into React state from an
  // effect — no post-mount cascade render, SSR falls back to the default
  // balance, and React Compiler can memoize the provider.
  const earningsBalance = useSyncExternalStore(
    subscribeToWallet,
    readWalletBalance,
    getServerWalletBalance
  );

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
