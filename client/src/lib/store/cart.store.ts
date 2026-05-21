import { create } from 'zustand';
import { cartApi } from '../api';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  variantId?: string;
}

interface Cart {
  userId: string;
  items: CartItem[];
  total: number;
  updatedAt: Date;
}

interface CartState {
  cart: Cart | null;
  isLoading: boolean;
  fetchCart: () => Promise<void>;
  addItem: (item: CartItem) => Promise<void>;
  updateItem: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

export const useCartStore = create<CartState>((set) => ({
  cart: null,
  isLoading: false,

  fetchCart: async () => {
    set({ isLoading: true });
    try {
      const { data } = await cartApi.getCart();
      set({ cart: data.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addItem: async (item) => {
    set({ isLoading: true });
    try {
      const { data } = await cartApi.addItem(item);
      set({ cart: data.data, isLoading: false });
    } catch {
      set({ isLoading: false });
      throw new Error('Failed to add item');
    }
  },

  updateItem: async (productId, quantity) => {
    const { data } = await cartApi.updateItem(productId, quantity);
    set({ cart: data.data });
  },

  removeItem: async (productId) => {
    const { data } = await cartApi.removeItem(productId);
    set({ cart: data.data });
  },

  clearCart: async () => {
    await cartApi.clearCart();
    set({ cart: null });
  },
}));