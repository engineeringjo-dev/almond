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
    // Pin the root to the *small* viewport height (`100svh`) — the smallest
    // visible area, i.e. with the browser bars shown. Unlike `100dvh`/`100vh`
    // (which on some Android browsers include the area under the gesture bar),
    // `svh` guarantees the bottom tab bar always stays fully on-screen. `100vh`
    // is kept as a fallback for browsers without `svh`.
    style.textContent = '#root{height:100vh;height:100svh;min-height:100svh;}';
    document.head.appendChild(style);
  }
}
