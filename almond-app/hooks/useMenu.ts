import { useQuery } from '@tanstack/react-query';
import { menuService } from '@/services/menu.service';

// The menu rarely changes within a session, so cache it hard and never refetch
// on window focus (avoids a needless fetch every time the tab regains focus).
const MENU_CACHE = { staleTime: Infinity, refetchOnWindowFocus: false } as const;

export function useCategories() {
  return useQuery({
    queryKey: ['menu', 'categories'],
    queryFn: () => menuService.getCategories(),
    ...MENU_CACHE,
  });
}

export function useMenuItems(categoryId?: string) {
  return useQuery({
    queryKey: ['menu', 'items', categoryId ?? 'all'],
    queryFn: () => menuService.getItems(categoryId),
    ...MENU_CACHE,
  });
}

export function useMenuItem(id: string) {
  return useQuery({
    queryKey: ['menu', 'item', id],
    queryFn: () => menuService.getItem(id),
    enabled: !!id,
    ...MENU_CACHE,
  });
}
