/** Simulate network latency so loading states are exercised in mock mode. */
export function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Haversine distance in km between two lat/lng points (section 7.1). */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Is the branch open now, comparing local time to its hours (section 7.1)? */
export function isBranchOpen(
  hours: { open: string; close: string },
  now = new Date(),
): boolean {
  const [oh, om] = hours.open.split(':').map(Number);
  let [ch, cm] = hours.close.split(':').map(Number);
  // "24:00" means midnight end-of-day.
  if (ch === 24) {
    ch = 23;
    cm = 59;
  }
  const mins = now.getHours() * 60 + now.getMinutes();
  const openM = oh * 60 + om;
  const closeM = ch * 60 + cm;
  return mins >= openM && mins <= closeM;
}

let counter = 1;
export function genId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${counter++}`;
}
