import { create } from 'zustand';
import { CONFIG } from '../lib/config';
import type { AuthState } from './auth-store.types';
import { createAccountActions } from './auth-store-account';
import { createCredentialActions } from './auth-store-credentials';
import {
  createCleanupAction,
  createInitializeAction,
} from './auth-store-initialize';
import { createOAuthActions } from './auth-store-oauth';

export type { AuthState, Customer } from './auth-store.types';

const MERCHANT_SLUG = CONFIG.MERCHANT_SLUG;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  customer: null,
  merchantId: null,
  isLoading: true,
  isInitialized: false,
  error: null,
  _authSubscription: null,
  _initializationInProgress: false,
  _initGen: 0,

  initialize: createInitializeAction({
    get,
    merchantSlug: MERCHANT_SLUG,
    set,
  }),
  cleanup: createCleanupAction(set, get),
  ...createCredentialActions(set, get),
  ...createOAuthActions(set, get),
  ...createAccountActions(set, get),
  clearError: () => {
    set({ error: null });
  },
}));
