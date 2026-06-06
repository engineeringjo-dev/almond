'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CupState, GiftCard, GiftOccasion, PointsLogEntry, Voucher } from '@almond/shared/types';
import { config } from '@/lib/config';
import { reloadBonus, genGiftCode, type RewardOption } from '@/data/loyalty';

export interface WalletTxn {
  id: string;
  amount: number; // +credit / -debit, JOD
  labelAr: string;
  labelEn: string;
  createdAt: string;
}

interface SendGiftInput {
  amount: number;
  recipientName: string;
  message?: string;
  occasion: GiftOccasion;
}

interface LoyaltyState {
  points: number;
  windowSpend: number; // rolling-12-month spend → tier
  cup: CupState;
  walletBalance: number;
  vouchers: Voucher[];
  pointsHistory: PointsLogEntry[];
  walletHistory: WalletTxn[];
  giftsSent: GiftCard[];

  redeemReward: (reward: RewardOption) => boolean;
  topUp: (amount: number) => void;
  sendGift: (input: SendGiftInput) => GiftCard;
  redeemGift: (code: string) => boolean;
}

const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
const daysAhead = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

export const useLoyaltyStore = create<LoyaltyState>()(
  persist(
    (set, get) => ({
      // Seed so the site is demoable: Silver tier (windowSpend ≥ 100), a cup in
      // progress, a stored-value balance, a voucher and some recent activity.
      points: 240,
      windowSpend: 120,
      cup: { current: 6, target: config.CUP_TARGET },
      walletBalance: 12.5,
      vouchers: [
        {
          id: rid('v'),
          titleAr: 'مشروب مجاني',
          titleEn: 'Free drink',
          type: 'free-item',
          expiresAt: daysAhead(30),
          used: false,
        },
      ],
      pointsHistory: [
        { id: rid('p'), deltaPoints: 45, reasonAr: 'طلب قهوة', reasonEn: 'Coffee order', createdAt: daysAgo(2) },
        { id: rid('p'), deltaPoints: 50, reasonAr: 'مكافأة شحن المحفظة', reasonEn: 'Wallet reload bonus', createdAt: daysAgo(5) },
      ],
      walletHistory: [
        { id: rid('w'), amount: 20, labelAr: 'شحن المحفظة', labelEn: 'Wallet top-up', createdAt: daysAgo(5) },
        { id: rid('w'), amount: -2.9, labelAr: 'طلب', labelEn: 'Order', createdAt: daysAgo(2) },
      ],
      giftsSent: [],

      redeemReward: (reward) => {
        if (get().points < reward.cost) return false;
        set((s) => ({
          points: s.points - reward.cost,
          vouchers: [
            {
              id: rid('v'),
              titleAr: reward.titleAr,
              titleEn: reward.titleEn,
              type: reward.type === 'credit' ? 'credit' : 'free-item',
              value: reward.value,
              expiresAt: daysAhead(60),
              used: false,
            },
            ...s.vouchers,
          ],
          pointsHistory: [
            {
              id: rid('p'),
              deltaPoints: -reward.cost,
              reasonAr: `استبدال: ${reward.titleAr}`,
              reasonEn: `Redeemed: ${reward.titleEn}`,
              createdAt: new Date().toISOString(),
            },
            ...s.pointsHistory,
          ],
        }));
        return true;
      },

      topUp: (amount) => {
        const bonus = reloadBonus(amount);
        set((s) => ({
          walletBalance: s.walletBalance + amount,
          points: s.points + bonus,
          walletHistory: [
            { id: rid('w'), amount, labelAr: 'شحن المحفظة', labelEn: 'Wallet top-up', createdAt: new Date().toISOString() },
            ...s.walletHistory,
          ],
          pointsHistory:
            bonus > 0
              ? [
                  { id: rid('p'), deltaPoints: bonus, reasonAr: 'مكافأة شحن المحفظة', reasonEn: 'Reload bonus', createdAt: new Date().toISOString() },
                  ...s.pointsHistory,
                ]
              : s.pointsHistory,
        }));
      },

      sendGift: (input) => {
        const card: GiftCard = {
          id: rid('g'),
          code: genGiftCode(),
          designId: input.occasion,
          amount: input.amount,
          recipientName: input.recipientName,
          message: input.message,
          senderId: 'guest',
          createdAt: new Date().toISOString(),
          redeemed: false,
        };
        set((s) => ({ giftsSent: [card, ...s.giftsSent] }));
        return card;
      },

      redeemGift: (code) => {
        const norm = code.trim().toUpperCase();
        const sent = get().giftsSent.find((g) => g.code === norm && !g.redeemed);
        if (sent) {
          set((s) => ({
            walletBalance: s.walletBalance + sent.amount,
            giftsSent: s.giftsSent.map((g) => (g.id === sent.id ? { ...g, redeemed: true } : g)),
            walletHistory: [
              { id: rid('w'), amount: sent.amount, labelAr: 'استبدال هدية', labelEn: 'Gift redeemed', createdAt: new Date().toISOString() },
              ...s.walletHistory,
            ],
          }));
          return true;
        }
        // Demo: any well-formed code credits a 5 JOD gift.
        if (/^ALMOND-[A-Z0-9]{5}$/.test(norm)) {
          set((s) => ({
            walletBalance: s.walletBalance + 5,
            walletHistory: [
              { id: rid('w'), amount: 5, labelAr: 'استبدال هدية', labelEn: 'Gift redeemed', createdAt: new Date().toISOString() },
              ...s.walletHistory,
            ],
          }));
          return true;
        }
        return false;
      },
    }),
    {
      name: 'almond-loyalty',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : (undefined as never),
      ),
    },
  ),
);
