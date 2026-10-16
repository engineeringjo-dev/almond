import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { createInstance } from 'i18next';

import { VisitRatingSheet } from '@/components/loyalty/VisitRatingSheet';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { I18N_OPTIONS } from '@/lib/i18nOptions';

const captured = vi.hoisted(() => ({ children: undefined as React.ReactNode }));
const language = vi.hoisted(() => ({
  lang: 'ar' as 'ar' | 'en',
  t: (key: string, _params?: Record<string, unknown>): string => key,
}));

// Render the real sheet's controls while isolating native modal, account and
// service boundaries. The captured tree contains the actual Pressable props,
// labels, number children, icons and styles produced by VisitRatingSheet.
vi.mock('@/components/ui/BottomSheet', () => ({ BottomSheet: ({ children }: { children: React.ReactNode }) => {
  captured.children = children;
  return null;
} }));
vi.mock('@/components/ui/Text', () => ({ Text: () => null }));
vi.mock('@/components/ui/Icon', () => ({ Icon: () => null }));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => language }));
vi.mock('@/hooks/useLoyalty', () => ({ useLoyaltyBalance: () => ({ data: undefined }) }));
vi.mock('@/stores/authStore', () => ({ useUserId: () => 'rating-number-test' }));
vi.mock('@/stores/toastStore', () => ({ useToastStore: { getState: () => ({ showError: vi.fn() }) } }));
vi.mock('@/services/loyalty.service', () => ({ loyaltyService: { rateVisit: vi.fn() } }));

type Element = React.ReactElement<Record<string, unknown>>;
function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as React.ReactNode)];
}

beforeEach(() => {
  captured.children = undefined;
  // Metro handles the app's JSX; the Node test transform uses classic JSX.
  vi.stubGlobal('React', React);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('VN1 each visible rating number belongs to the same labelled star control', () => {
  for (const lang of ['ar', 'en'] as const) {
    it(`${lang}: pairs Latin 1–5 with matching radio names, before the star, without a second announcement`, async () => {
      const i18n = createInstance();
      await i18n.init({ ...I18N_OPTIONS, lng: lang });
      language.lang = lang;
      language.t = (key, params) => i18n.t(key, params);
      renderToStaticMarkup(React.createElement(VisitRatingSheet, {
        visible: true, onClose: vi.fn(), visitRef: 'order:rating-number-test', branchName: null,
      }));

      const controls = elements(captured.children).filter((element) => element.props.role === 'radio');
      expect(controls).toHaveLength(5);
      for (const [index, control] of controls.entries()) {
        const value = index + 1;
        expect(control.props['aria-label']).toBe(i18n.t('visit.starsLabel', { n: value }));
        expect(control.props['aria-checked']).toBe(false);
        const children = React.Children.toArray(control.props.children as React.ReactNode).filter(React.isValidElement) as Element[];
        expect(children.map((child) => child.type)).toEqual([Text, Icon]);
        expect(children[0].props.children).toBe(String(value));
        expect(children[0].props['aria-hidden']).toBe(true);
        const style = StyleSheet.flatten(control.props.style as StyleProp<ViewStyle>);
        expect(style.flexDirection).toBe('column');
        expect(style.minWidth).toBeGreaterThanOrEqual(44);
        expect(style.minHeight).toBeGreaterThanOrEqual(44);
      }
    });
  }
});
