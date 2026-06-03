import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * User-saved favourite menu items (♥) for instant reorder (Order Experience
 * Engineering Spec §2.4). Persisted locally; keyed by menu item id.
 */
interface FavouritesState {
  ids: string[];
  hydrated: boolean;
  toggle: (itemId: string) => void;
  isFavourite: (itemId: string) => boolean;
  hydrate: () => Promise<void>;
}

const KEY = 'almond.favourites';

export const useFavouritesStore = create<FavouritesState>((set, get) => ({
  ids: [],
  hydrated: false,

  toggle: (itemId) => {
    const has = get().ids.includes(itemId);
    const next = has ? get().ids.filter((x) => x !== itemId) : [...get().ids, itemId];
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    set({ ids: next });
  },

  isFavourite: (itemId) => get().ids.includes(itemId),

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      set({ ids: raw ? JSON.parse(raw) : [], hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
