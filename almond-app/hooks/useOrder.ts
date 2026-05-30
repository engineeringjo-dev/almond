import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { orderService, type CreateOrderInput } from '@/services/order.service';
import { useUserId } from '@/stores/authStore';
import type { CartItem, Order } from '@/types';

export function useActiveOrders() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['orders', 'active', userId],
    queryFn: () => orderService.getActiveOrders(userId),
    refetchInterval: 15000, // keep the tracking timeline fresh
  });
}

export function useOrderHistory() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['orders', 'history', userId],
    queryFn: () => orderService.getHistory(userId),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: () => orderService.getOrder(id),
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => orderService.createOrder(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useAdvanceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => orderService.advanceStatus(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => orderService.cancelOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

/**
 * "My Usual" (section 7.2): find the most-frequent line-item set from history.
 * Returns the items of the most recent occurrence of the top-frequency signature.
 */
export function useUsualOrder(): { items: CartItem[]; from: Order } | null {
  const { data } = useOrderHistory();
  if (!data || data.length === 0) return null;

  const freq = new Map<string, number>();
  const signature = (o: Order) =>
    o.items
      .map((i) => `${i.itemId}:${i.sizeId}:${i.qty}`)
      .sort()
      .join('|');

  data.forEach((o: Order) => {
    const sig = signature(o);
    freq.set(sig, (freq.get(sig) ?? 0) + 1);
  });

  let topSig = '';
  let topCount = 0;
  freq.forEach((count, sig) => {
    if (count > topCount) {
      topCount = count;
      topSig = sig;
    }
  });

  const match = data.find((o: Order) => signature(o) === topSig);
  return match ? { items: match.items, from: match } : null;
}
