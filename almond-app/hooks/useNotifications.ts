import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { notificationService } from '@/services/notification.service';
import { useUserId } from '@/stores/authStore';
import type { NotifSettings } from '@/types';

export function useInbox() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['notifications', 'inbox', userId],
    queryFn: () => notificationService.getInbox(userId),
  });
}

export function useNotifSettings() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['notifications', 'settings', userId],
    queryFn: () => notificationService.getSettings(userId),
  });
}

export function useUpdateNotifSettings() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: NotifSettings) =>
      notificationService.updateSettings(userId, settings),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['notifications', 'settings', userId] }),
  });
}

export function useMarkRead() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'inbox', userId] }),
  });
}

export function useActiveVisitReward() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['rewards', 'visit', userId],
    queryFn: () => notificationService.getActiveVisitReward(userId),
  });
}
