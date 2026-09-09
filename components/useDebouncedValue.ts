"use client";

import { useEffect, useState } from "react";

/**
 * Değeri, son değişiklikten `delay` ms sonra yansıtır. Kaydırak sürüklenirken
 * pahalı hesaplar (kadro optimizasyonu ~0,3 s) her karede değil, el durunca
 * bir kez koşsun diye.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
