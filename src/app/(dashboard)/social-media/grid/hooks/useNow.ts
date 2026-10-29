'use client';

import { useEffect, useState } from 'react';

/**
 * Reloj del cliente (ms). Arranca en 0 para que servidor y primer render coincidan;
 * 0 significa "hora todavía desconocida". Se actualiza cada `intervalMs`.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, intervalMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}
