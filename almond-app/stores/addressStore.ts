import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Address {
  id: string;
  label: string;
  details: string;
}

interface AddressState {
  addresses: Address[];
  add: (label: string, details: string) => void;
  remove: (id: string) => void;
  hydrate: () => Promise<void>;
}

const KEY = 'almond.addresses';

export const useAddressStore = create<AddressState>((set, get) => ({
  addresses: [],
  add: (label, details) => {
    const next = [
      ...get().addresses,
      { id: `addr_${Date.now()}`, label, details },
    ];
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    set({ addresses: next });
  },
  remove: (id) => {
    const next = get().addresses.filter((a) => a.id !== id);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    set({ addresses: next });
  },
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) set({ addresses: JSON.parse(raw) });
    } catch {
      // ignore
    }
  },
}));
