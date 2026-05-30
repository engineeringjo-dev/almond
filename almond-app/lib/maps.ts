import { Linking } from 'react-native';

/** Open Google Maps directions to a branch (Revision Pack §I). */
export function openDirections(lat: number, lng: number) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  Linking.openURL(url).catch(() => {});
}
