import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { menuItems } from '@almond/shared/menu';
import { ItemConfigurator } from '@/components/menu/ItemConfigurator';
import messages from '@/messages/en.json';

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: 'Menu' | 'Nav') => (key: string, values: Record<string, string> = {}) => {
    const strings = messages[namespace] as Record<string, string>;
    return Object.entries(values).reduce((copy, [name, value]) => copy.replaceAll(`{${name}}`, value), strings[key] ?? key);
  },
}));
vi.mock('@/i18n/navigation', async () => {
  const { createElement: element } = await import('react');
  return { Link: ({ children, href }: { children: React.ReactNode; href: string }) => element('a', { href }, children) };
});

const cake = menuItems.find((item) => item.id === 'p-10307')!;
const buttons = (html: string) => [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0]);
// Next supplies the automatic JSX runtime; this existing Vitest configuration
// uses classic JSX when rendering TSX in Node.
beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => vi.unstubAllGlobals());

describe('the website cannot offer an ambiguous cake size as selectable', () => {
  it('renders every ambiguous L visibly unavailable, while S/M remain available', () => {
    const html = renderToStaticMarkup(createElement(ItemConfigurator, { item: cake }));
    const controls = buttons(html);
    for (const name of ['15 (تواصي)', '20 (تواصي)', '25 (تواصي)']) {
      const choice = controls.find((button) => button.includes(name))!;
      expect(choice).toContain('disabled=""');
      expect(choice).toContain('aria-pressed="false"');
      expect(choice).toContain(messages.Menu.sizeUnavailable);
    }
    for (const name of ['(6-8) people', '(10-12) poeple']) {
      expect(controls.find((button) => button.includes(name))).not.toContain('disabled=""');
    }
    expect(html).toContain(messages.Menu.sizeUnavailableNotice);
  });

  it('disables Add when no size can be identified, rather than quoting a fallback', () => {
    const html = renderToStaticMarkup(createElement(ItemConfigurator, { item: { ...cake, sizes: cake.sizes.slice(2) } }));
    const add = buttons(html).find((button) => button.replace(/<[^>]*>/g, '').trim() === messages.Menu.sizeUnavailable)!;
    expect(add).toContain('disabled=""');
    expect(add).toContain(messages.Menu.sizeUnavailable);
    expect(add).not.toContain(messages.Menu.addToCart);
  });
});
