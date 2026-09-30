import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { choiceA11y, choiceGroupA11y, tabA11y } from '@/lib/a11y';

/**
 * A1-A3 — A SCREEN READER HEARS WHAT IS CHOSEN (audit P1).
 *
 * Size, milk, «إضافات» and pairing chips carried no role or state at all; the
 * payment radios said `selected` where a radio needs `checked`; the order-type
 * tabs had no tablist; the barcode tab called itself a button inside the tab
 * bar. On the web build even the state that WAS set never reached the DOM:
 * react-native-web 0.21 drops `accessibilityState`. A1 pins what the helpers
 * emit, A2 that the ordering journey uses them, A3 that the helpers stay the
 * only way selection state is expressed there.
 */

describe('A1 the helpers emit the ARIA a platform reads', () => {
  it('a radio says it is a radio, whether it is checked, and its name with price', () => {
    expect(choiceA11y('radio', true, 'وسط، 3.100 د.أ')).toEqual({
      role: 'radio',
      'aria-checked': true,
      'aria-label': 'وسط، 3.100 د.أ',
    });
    expect(choiceA11y('radio', false, 'صغير')['aria-checked']).toBe(false);
  });

  it('a checkbox is a checkbox — many answers allowed', () => {
    expect(choiceA11y('checkbox', true, 'x')).toMatchObject({ role: 'checkbox', 'aria-checked': true });
  });

  it('single choice is a radiogroup; multiple is a group', () => {
    expect(choiceGroupA11y(false, 'الحليب').role).toBe('radiogroup');
    expect(choiceGroupA11y(true, 'إضافات').role).toBe('group');
    expect(choiceGroupA11y(true, 'إضافات')['aria-label']).toBe('إضافات');
  });

  it('a tab reports whether it is the selected one', () => {
    expect(tabA11y(true, 'الباركود')).toEqual({ role: 'tab', 'aria-selected': true, 'aria-label': 'الباركود' });
    expect(tabA11y(false, 'الباركود')['aria-selected']).toBe(false);
  });
});

const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

describe('A2 the ordering journey uses them', () => {
  it('the item sheet: sizes are radios, option groups radio/checkbox by `multiple`, pairings checkboxes', () => {
    const s = src('components/menu/ItemModal.tsx');
    expect(s).toMatch(/choiceGroupA11y\(false, t\('menu\.size'\)\)/);
    expect(s).toMatch(/choiceA11y\(\s*'radio',\s*s\.id === sizeId/);
    expect(s).toMatch(/choiceGroupA11y\(g\.multiple/);
    expect(s).toMatch(/g\.multiple \? 'checkbox' : 'radio'/);
    expect(s).toMatch(/choiceA11y\('checkbox', isStaged/);
  });

  it('payment is a radiogroup of checked radios; order type a tablist; the barcode a tab', () => {
    expect(src('components/cart/PaymentMethods.tsx')).toMatch(/choiceA11y\('radio', active/);
    expect(src('components/cart/PaymentMethods.tsx')).toMatch(/choiceGroupA11y\(false/);
    expect(src('components/cart/OrderTypeTabs.tsx')).toMatch(/role="tablist"/);
    expect(src('components/cart/OrderTypeTabs.tsx')).toMatch(/tabA11y\(active/);
    expect(src('components/ui/TabBarBarcodeButton.tsx')).toMatch(/tabA11y\(focused/);
  });
});

describe('A3 selection state is never expressed through accessibilityState here', () => {
  it('none of the fixed files falls back to the prop the web build drops', () => {
    const files = [
      'components/menu/ItemModal.tsx',
      'components/cart/PaymentMethods.tsx',
      'components/cart/OrderTypeTabs.tsx',
      'components/ui/TabBarBarcodeButton.tsx',
    ];
    const offenders = files.filter((f) => /accessibilityState=\{\{\s*(selected|checked)/.test(src(f)));
    expect(offenders).toEqual([]);
  });
});

describe('A4 cart and search controls are named, in the reader\'s language', () => {
  it('no control carries a hard-coded English label', () => {
    for (const f of ['components/ui/Stepper.tsx', 'components/cart/CartLine.tsx', 'components/ui/SearchBar.tsx']) {
      expect(src(f), f).not.toMatch(/accessibilityLabel="[A-Za-z]/);
    }
  });

  it('the stepper, delete, clear and switch are labelled through i18n', () => {
    expect(src('components/ui/Stepper.tsx')).toMatch(/t\('cart\.decreaseQty'/);
    expect(src('components/ui/Stepper.tsx')).toMatch(/t\('cart\.increaseQty'/);
    expect(src('components/cart/CartLine.tsx')).toMatch(/accessibilityLabel=\{t\('cart\.removeItem', \{ name \}\)\}/);
    expect(src('components/ui/SearchBar.tsx')).toMatch(/accessibilityLabel=\{t\('common\.clearSearch'\)\}/);
    expect(src('components/ui/Toggle.tsx')).toMatch(/aria-label=\{label\}/);
  });

  it('the delete target is at least 44×44 — sized, since the web ignores hitSlop', () => {
    const s = src('components/cart/CartLine.tsx');
    const block = s.slice(s.indexOf('remove: {'));
    const w = Number(/width:\s*(\d+)/.exec(block)?.[1]);
    const h = Number(/height:\s*(\d+)/.exec(block)?.[1]);
    expect(w).toBeGreaterThanOrEqual(44);
    expect(h).toBeGreaterThanOrEqual(44);
  });
});
