export interface StorefrontTransformedOrderItem {
  id: string;
  product_id: string;
  image_url?: string;
  name: string;
  quantity: number;
  price: number;
  has_assurance?: boolean;
  product_slug?: string;
  category?: string;
  category_slug?: string;
  categories?: { name: string; slug: string } | null;
  image?: string;
  product_image?: string;
}

export interface StorefrontTransformedOrder {
  id: string;
  order_number: string;
  created_at: string;
  total: number;
  subtotal: number;
  shipping_fee: number;
  tax_amount: number;
  discount_amount: number;
  amount_paid: number;
  currency: string;
  payment_status: string;
  shipping_status: string;
  shipping_address: Record<string, unknown> | null;
  tracking_number?: string;
  shipping_provider?: string;
  payment_method?: string;
  balance: number;
  current_document_kind: string;
  receipt_eligible: boolean;
  items: StorefrontTransformedOrderItem[];
  status?: string;
}

export interface StorefrontWalletTransaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
  /**
   * Ledger source discriminator (`'wallet_topup'` for a bank-transfer/card
   * top-up). `type` is `'credit'` for cashback and refunds too, so this is the
   * only field that can prove an inbound transfer landed. Optional: older
   * cached responses predate the column being exposed.
   */
  source_type?: string | null;
}

export interface StorefrontWalletFundingAccount {
  accountName: string | null;
  accountNumber: string;
  bankName: string | null;
  provider: string;
}

export interface StorefrontWallet {
  balance: number;
  balances?: { NGN: number; USDT: number };
  totalEarned: number;
  totalRedeemed: number;
  transactions: StorefrontWalletTransaction[];
  hasWallet?: boolean;
  fundingAccount?: StorefrontWalletFundingAccount | null;
  requiresFundingAccountConsent?: boolean;
  walletDvaEnabled?: boolean;
}
