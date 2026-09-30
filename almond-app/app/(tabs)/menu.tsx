import { Redirect } from 'expo-router';

/**
 * `/menu` is the Order tab's «القائمة».
 *
 * This route used to be a second copy of the Order menu with no cart entry and
 * no active tab — reachable by URL on the web, where the 1.8 s toast was the
 * only way to the cart, and a copy that would drift (audit P2). The path stays
 * valid for old links and bookmarks: it lands on the one real menu, whose
 * first sub-tab is the menu.
 */
export default function MenuRedirect() {
  return <Redirect href="/(tabs)/order" />;
}
