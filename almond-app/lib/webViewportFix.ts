import { Platform } from 'react-native';

/**
 * Mobile-web viewport fix (no-op on native).
 *
 * In the web SPA build the generated `index.html` pins the app root to
 * `height: 100%`, which mobile browsers resolve against the *large* viewport
 * (system / browser bars hidden). The bottom tab bar, anchored to the viewport
 * edge, then slips underneath the Android gesture bar — the "floor is cut off"
 * report on Samsung. We switch the root to the dynamic viewport height
 * (`100dvh`, which always tracks the visible area) and enable `viewport-fit`
 * so safe-area insets resolve. Both are applied at runtime since `output:
 * 'single'` ignores a custom `+html.tsx`.
 */
export function applyWebViewportFix() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const viewport = document.querySelector('meta[name="viewport"]');
  const content = viewport?.getAttribute('content') ?? '';
  if (viewport && !/viewport-fit/.test(content)) {
    viewport.setAttribute('content', `${content}, viewport-fit=cover`);
  }

  const id = 'almond-dvh-fix';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    // `100vh` first as a fallback, then `100dvh` for browsers that support it.
    style.textContent = '#root{height:100vh;height:100dvh;min-height:100dvh;}';
    document.head.appendChild(style);
  }
}
