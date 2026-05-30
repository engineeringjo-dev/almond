import { useEffect, useState } from 'react';

/** Live countdown to a target ISO time. Returns remaining ms + mm:ss label. */
export function useCountdown(targetIso?: string) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!targetIso) return { remainingMs: 0, label: '00:00', done: true };

  const remainingMs = Math.max(0, new Date(targetIso).getTime() - now);
  const totalSec = Math.floor(remainingMs / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  const label = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return { remainingMs, label, done: remainingMs <= 0 };
}
