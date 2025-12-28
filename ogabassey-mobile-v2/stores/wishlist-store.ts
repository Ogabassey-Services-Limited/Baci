import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { syncStorage } from '../lib/storage';

export interface WishlistItem {
    id: string;
    name: string;
    slug: string;
    price: number;
    image: string;
    added_at: number;
}

interface WishlistState {
    items: WishlistItem[];

    // Actions
    addItem: (item: Omit<WishlistItem, 'added_at'>) => void;
    removeItem: (id: string) => void;
    isInWishlist: (id: string) => boolean;
    clearWishlist: () => void;
    toggleItem: (item: Omit<WishlistItem, 'added_at'>) => void;
}

export const useWishlistStore = create<WishlistState>()(
    persist(
        (set, get) => ({
            items: [],

            addItem: (item) => {
                set((state) => {
                    if (state.items.find((i) => i.id === item.id)) return state;
                    return {
                        items: [
                            ...state.items,
                            { ...item, added_at: Date.now() },
                        ],
                    };
                });
            },

            removeItem: (id) => {
                set((state) => ({
                    items: state.items.filter((i) => i.id !== id),
                }));
            },

            isInWishlist: (id) => {
                return !!get().items.find((i) => i.id === id);
            },

            toggleItem: (item) => {
                const { isInWishlist, addItem, removeItem } = get();
                if (isInWishlist(item.id)) {
                    removeItem(item.id);
                } else {
                    addItem(item);
                }
            },

            clearWishlist: () => {
                set({ items: [] });
            },
        }),
        {
            name: 'wishlist-storage',
            storage: createJSONStorage(() => syncStorage),
        }
    )
);
