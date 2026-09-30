import { Platform } from 'react-native';

/**
 * SPACE ACTIVATES A RADIO, A CHECKBOX, A SWITCH OR A TAB — ON THE WEB TOO.
 *
 * WAI-ARIA: Space checks a radio, toggles a checkbox or a switch, and selects a
 * tab. react-native-web's Pressable honours Space only when the element is a
 * `button` (usePressEvents/PressResponder `isValidKeyPress`): on the chips that
 * now correctly say role="radio"/"checkbox"/"tab", Space did nothing but scroll
 * the page, and only Enter worked. A keyboard or switch-access user who follows
 * the announced role hits a dead control.
 *
 * One capture-phase listener fixes every such control at once, including chips
 * in files this module does not own: Space on an element with one of those
 * roles is replayed as the Enter press react-native-web already handles
 * (keydown on the element, keyup on release), and the page does not scroll.
 * Native controls (button, input, textarea, select) keep their own behaviour;
 * a link with a role (the tab bar's <a role="tab">) is clicked, since
 * react-native-web leaves keyboard presses on links to the browser.
 */

const SPACE_ROLES = new Set(['radio', 'checkbox', 'switch', 'tab', 'option', 'menuitemradio', 'menuitemcheckbox']);
const NATIVE_CONTROLS = new Set(['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT']);

/** The part of a DOM element this module reads. */
export interface KeyTarget {
  tagName: string;
  getAttribute(name: string): string | null;
  isContentEditable?: boolean;
  dispatchEvent(event: unknown): boolean;
  click(): void;
}

/** The part of a KeyboardEvent this module reads. */
export interface KeyEventLike {
  key: string;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target: unknown;
  preventDefault(): void;
}

export type SpaceAction = 'none' | 'press' | 'click';

/** What Space should do on `el`. */
export function spaceAction(el: Pick<KeyTarget, 'tagName' | 'getAttribute' | 'isContentEditable'>): SpaceAction {
  const tag = el.tagName.toUpperCase();
  if (NATIVE_CONTROLS.has(tag) || el.isContentEditable) return 'none';
  const role = el.getAttribute('role');
  if (!role || !SPACE_ROLES.has(role)) return 'none';
  if (el.getAttribute('aria-disabled') === 'true') return 'none';
  return tag === 'A' ? 'click' : 'press';
}

const isSpace = (key: string) => key === ' ' || key === 'Spacebar';
const isKeyTarget = (t: unknown): t is KeyTarget =>
  !!t && typeof (t as KeyTarget).getAttribute === 'function' && typeof (t as KeyTarget).tagName === 'string';

/**
 * The two listeners, apart from any document so they can be tested in Node.
 * `makeEnter` builds the Enter event replayed on the element.
 */
export function createSpaceHandlers(makeEnter: (type: 'keydown' | 'keyup') => unknown) {
  let pending: { el: KeyTarget; action: Exclude<SpaceAction, 'none'> } | null = null;

  const onKeyDown = (e: KeyEventLike): void => {
    if (!isSpace(e.key) || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (!isKeyTarget(e.target)) return;
    const action = spaceAction(e.target);
    if (action === 'none') return;
    e.preventDefault(); // no page scroll
    if (e.repeat) return; // holding Space activates once
    pending = { el: e.target, action };
    if (action === 'press') e.target.dispatchEvent(makeEnter('keydown'));
  };

  const onKeyUp = (e: KeyEventLike): void => {
    if (!isSpace(e.key) || !pending || pending.el !== e.target) return;
    const { el, action } = pending;
    pending = null;
    e.preventDefault();
    if (action === 'press') el.dispatchEvent(makeEnter('keyup'));
    else el.click();
  };

  return { onKeyDown, onKeyUp };
}

interface ListenerTarget {
  addEventListener(type: string, fn: (e: KeyEventLike) => void, capture: boolean): void;
  removeEventListener(type: string, fn: (e: KeyEventLike) => void, capture: boolean): void;
}

/** Install on a document (web only). Returns the uninstaller. */
export function installSpaceActivation(
  doc: ListenerTarget,
  makeEnter: (type: 'keydown' | 'keyup') => unknown,
): () => void {
  const { onKeyDown, onKeyUp } = createSpaceHandlers(makeEnter);
  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('keyup', onKeyUp, true);
  return () => {
    doc.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('keyup', onKeyUp, true);
  };
}

let installed = false;

/** Called once at the app root; a no-op on native and when already installed. */
export function applySpaceActivation(): void {
  if (installed || Platform.OS !== 'web' || typeof document === 'undefined') return;
  installed = true;
  installSpaceActivation(
    document as unknown as ListenerTarget,
    (type) => new KeyboardEvent(type, { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }),
  );
}
