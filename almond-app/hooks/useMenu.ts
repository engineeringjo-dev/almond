import { useQuery } from '@tanstack/react-query';
import { menuService } from '@/services/menu.service';

export function useCategories() {
  return useQuery({
    queryKey: ['menu', 'categories'],
    queryFn: () => menuService.getCategories(),
    staleTime: 1000 * 60 * 10,
  });
}

export function useMenuItems(categoryId?: string) {
  return useQuery({
    queryKey: ['menu', 'items', categoryId ?? 'all'],
    queryFn: () => menuService.getItems(categoryId),
    staleTime: 1000 * 60 * 10,
  });
}

export function useMenuItem(id: string) {
  return useQuery({
    queryKey: ['menu', 'item', id],
    queryFn: () => menuService.getItem(id),
    enabled: !!id,
  });
}
