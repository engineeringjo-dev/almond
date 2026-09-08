'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CupState, GiftCard, GiftOccasion, PointsLogEntry, Voucher } from '@almond/shared/types';
import { config } from '@/lib/config';
import { reloadBonus, genGiftCode } from '@/data/loyalty';
import type { RedeemOption } from '@almond/shared/loyalty/redeem';

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
  windowSpend: number; // spend inside the 90-day window (config.TIER_WINDOW_DAYS) → tier
  cup: CupState;
  walletBalance: number;
  vouchers: Voucher[];
  pointsHistory: PointsLogEntry[];
  walletHistory: WalletTxn[];
  giftsSent: GiftCard[];

  /**
   * Spend `option.points` and mint a credit voucher worth `option.jod`.
   *
   * Takes a RedeemOption from @almond/shared/loyalty/redeem — the same builder
   * the app uses — rather than a website-local RewardOption off a board. The
   * board is gone; see the tombstone in data/loyalty.ts.
   */
  redeemReward: (option: RedeemOption) => boolean;
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
      // Seed so the site is demoable: a cup in progress, a stored-value
      // balance, a voucher and some recent activity.
      //
      // 🔴 windowSpend IS A DISPLAY SEED THAT NOTHING EVER WRITES (this literal
      // is its only occurrence in almond-web/src), and RewardsView interpolates
      // the rung's NAME into "{rate} back on every order". At the old seed of
      // 120 that is >= 65 JOD, i.e. the TOP rung, so the site told every
      // first-time visitor "6% back on every order" and «👑 وصلت للقمة» while
      // the code pays them 2%. 12 JOD is inside the entry rung, so the site
      // names the rate every member really gets and shows progress toward the
      // 4% rung instead of claiming to have arrived.
      points: 240,
      windowSpend: 12,
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

      redeemReward: (option) => {
        if (get().points < option.points) return false;
        // `option.jod`, not a division here: jodFromPoints is the one points→JOD
        // conversion in the repo and redeemOptions already applied it, so the
        // voucher is worth exactly what the member was shown before they
        // clicked. The title carries the amount because a credit voucher has no
        // other name — there is no reward to call it after.
        const jod = option.jod;
        set((s) => ({
          points: s.points - option.points,
          vouchers: [
            {
              id: rid('v'),
              titleAr: `خصم ${jod.toFixed(3)} د.أ من فاتورتك`,
              titleEn: `${jod.toFixed(3)} JOD off your bill`,
              // A credit, always. Points are money now; they do not buy a named
              // free item capped at a value.
              type: 'credit',
              value: jod,
              expiresAt: daysAhead(60),
              used: false,
            },
            ...s.vouchers,
          ],
          pointsHistory: [
            {
              id: rid('p'),
              deltaPoints: -option.points,
              reasonAr: `استبدال نقاط: ${jod.toFixed(3)} د.أ`,
              reasonEn: `Points redeemed: ${jod.toFixed(3)} JOD`,
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
      // Bumped when the seed above changed meaning. Without it a returning
      // visitor keeps the persisted windowSpend: 120 in localStorage and goes
      // on being told "6% back on every order"; zustand drops a persisted
      // state whose version does not match and no migrate is supplied, so the
      // corrected seed actually reaches them.
      version: 2,
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : (undefined as never),
      ),
    },
  ),
);
