"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { type Job, jobKey, runJob } from "@/lib/compute-jobs";
import { createComputeStore, type Settled, type View, viewOf, type WorkerLike } from "@/lib/compute-store";

/**
 * Ağır hesabı (kadro kurma) Web Worker'da yapar ve sonucu anahtarıyla saklar.
 *
 * Eskiden hesap doğrudan `useMemo` içinde, ana iş parçacığında koşuyordu:
 * kaydırak oynatınca ya da sayfaya girince ekran boyanmadan donuyordu.
 * Worker'da ekran hemen boyanıyor; aynı girdiye ikinci kez gelindiğinde
 * (sayfaya dönüş) sonuç önbellekten anında geliyor.
 *
 * Yaşam döngüsü `lib/compute-store.ts`'te: hiçbir iş askıda kalmıyor, hata
 * ekrana "yeniden dene" ile çıkıyor, önceki ayarların sonucu yeni ayarlarınki
 * diye sunulmuyor.
 */
const store = createComputeStore<Job>({
  run: (job) => runJob(job),
  createWorker: () => {
    if (typeof Worker === "undefined") return null;
    // `type: "module"` olmadan Turbopack dosyayı worker girişi olarak
    // derlemiyor, ham .ts'yi statik dosya diye kopyalıyor.
    return new Worker(new URL("../lib/compute.worker.ts", import.meta.url), {
      type: "module",
    }) as unknown as WorkerLike;
  },
});

/** Sonucu verir; hata olursa reddedilir. Tıklamayla başlayan işler için. */
export function compute<T>(job: Job, key: string = jobKey(job)): Promise<T> {
  return store.compute<T>(job, key);
}

/** Sonuç ya da hata; reddedilmez. Arka plan hazırlığı için. */
export function settle<T>(job: Job, key: string = jobKey(job)): Promise<Settled<T>> {
  return store.settle<T>(job, key);
}

/**
 * İşin sonucu. Yeni girdinin sonucu gelene kadar bir önceki sonuç gösterilir;
 * `stale` onun önceki girdiye ait olduğunu söyler. `retry` aynı işi yeniden
 * başlatır.
 */
export function useComputed<T>(job: Job | null): View<T> & { retry: () => void } {
  const key = useMemo(() => (job ? jobKey(job) : null), [job]);
  const entry = useSyncExternalStore(
    store.subscribe,
    () => (key === null ? undefined : store.snapshot(key)),
    () => undefined,
  );
  const [shown, setShown] = useState<{ key: string; value: T } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!job || key === null) return;
    let live = true;
    void store.settle<T>(job, key).then((settled) => {
      if (live && settled.ok) setShown({ key, value: settled.value });
    });
    return () => {
      live = false;
    };
  }, [job, key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...viewOf<T>(key, entry, shown), retry };
}
