import { Platform, type ViewProps } from 'react-native';

/**
 * SELECTION SEMANTICS FOR CUSTOM CHIPS.
 *
 * The item sheet, payment list and order-type switch draw their own chips, so
 * nothing told VoiceOver/TalkBack — or a browser — which size, milk or add-on
 * was chosen, or whether a group took one answer or many (audit P1). And the
 * old `accessibilityState={{ selected }}` never reached the web DOM at all:
 * react-native-web 0.21 drops accessibilityState, which is why axe reported
 * six radios without aria-checked on the cart.
 *
 * These helpers emit the ARIA props React Native maps on every platform (RN
 * ≥ 0.71 reads `role` and `aria-*` natively; react-native-web writes them to
 * the DOM). One place, so a chip cannot say "radio" and forget "checked".
 */

type A11yProps = Pick<ViewProps, 'role' | 'aria-checked' | 'aria-selected' | 'aria-label'>;

/** One option in a single-choice (radio) or multi-choice (checkbox) group. */
export function choiceA11y(kind: 'radio' | 'checkbox', checked: boolean, label: string): A11yProps {
  return { role: kind, 'aria-checked': checked, 'aria-label': label };
}

/** The container: a radiogroup when one answer is allowed, else a group. */
export function choiceGroupA11y(multiple: boolean, label: string): A11yProps {
  return { role: multiple ? 'group' : 'radiogroup', 'aria-label': label };
}

/** One tab of a tablist (the tab bar's custom barcode button, the order type). */
export function tabA11y(selected: boolean, label: string): A11yProps {
  return { role: 'tab', 'aria-selected': selected, 'aria-label': label };
}

/**
 * One link of an in-page navigation — the menu's section bar, which JUMPS to a
 * section and marks the one in view. WAI-ARIA: tabs switch panels; links that
 * move within a page are navigation, and the one the reader is at is
 * `aria-current` (the website's CategoryRail says the same). VoiceOver and
 * TalkBack have no "current" trait, so the native build reads it as selected;
 * react-native-web drops accessibilityState, so the web reads only ARIA.
 */
export function navItemA11y(
  current: boolean,
  label: string,
): Pick<ViewProps, 'role' | 'aria-label' | 'accessibilityState'> & { 'aria-current'?: 'true' } {
  return {
    role: 'button',
    'aria-label': label,
    ...(current ? { 'aria-current': 'true' as const } : {}),
    accessibilityState: { selected: current },
  };
}

/**
 * The smallest touch target, per platform: 44 pt (Apple HIG) on iOS and the
 * web, 48 dp (Material 3) on Android. React Native units are points on iOS and
 * dp on Android, so one number cannot satisfy both. Sized, not hitSlop'd —
 * react-native-web ignores hitSlop.
 */
export function minTouchTarget(platform: string = Platform.OS): 44 | 48 {
  return platform === 'android' ? 48 : 44;
}

export const MIN_TOUCH_TARGET = minTouchTarget();
