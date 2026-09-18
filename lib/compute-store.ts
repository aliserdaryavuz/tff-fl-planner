/**
 * Worker hesaplarının önbelleği ve yaşam döngüsü.
 *
 * Köken: `../ucl-fantasy-planner/lib/compute-store.ts`. Oradaki mantık denetim
 * sonrası sertleşmiş; yeniden icat etmek düzeltilmiş hataları geri getirirdi.
 *
 * React'ten ve veri dosyalarından bağımsız: worker, hesap ve zamanlayıcı
 * dışarıdan veriliyor, böylece hata senaryoları sahte worker'la sınanabiliyor.
 * Arayüz bağlantısı `components/useComputed.ts`.
 *
 * Kurallar:
 * - `settle` hiçbir zaman reddedilmez ve askıda kalmaz: sonuç ya `ok` ya hata.
 *   Worker yok, açılamadı, mesaj kopyalanamadı, worker düştü, cevap gelmedi ya
 *   da çözümlenemedi → hesap ana iş parçacığında denenir; o da hata verirse
 *   hata kaydı.
 * - Süren iş kaydı her yolda silinir; hatalı anahtar yeniden istenince yeniden
 *   hesaplanır (hata önbellekte kalıcı değil).
 * - Zaman aşımı: worker `timeoutMs` içinde cevap vermezse kapatılır, bekleyen
 *   işler ana iş parçacığında sürer.
 */

export type Reply = { id: number; result?: unknown; error?: string };

export type WorkerLike = {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
};

export type Entry = { state: "done"; value: unknown } | { state: "error"; error: string };
export type Settled<T> = { ok: true; value: T } | { ok: false; error: string };

export type StoreOptions<J> = {
  run: (job: J) => unknown;
  createWorker?: () => WorkerLike | null;
  timeoutMs?: number;
  limit?: number;
  /** Ana iş parçacığındaki hesabı sonraki tura bırakır; ekran önce boyansın. */
  defer?: (fn: () => void) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

/** Düşen ya da cevapsız worker'ın yerine en çok bu kadar kez yenisi kuruluyor. */
export const MAX_WORKER_RESTARTS = 2;

/** Yavaş telefondaki en uzun işin on katı. */
const COMPUTE_TIMEOUT_MS = 20_000;

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function createComputeStore<J>(options: StoreOptions<J>) {
  const {
    run,
    createWorker = () => null,
    timeoutMs = COMPUTE_TIMEOUT_MS,
    limit = 24,
    defer = (fn) => void setTimeout(fn, 0),
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  } = options;

  const entries = new Map<string, Entry>();
  const running = new Map<string, Promise<Settled<unknown>>>();
  const listeners = new Set<() => void>();
  const replies = new Map<number, (reply: Reply) => void>();
  let worker: WorkerLike | null | undefined;
  let restarts = 0;
  let nextId = 0;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  function publish(key: string, entry: Entry) {
    entries.delete(key);
    entries.set(key, entry);
    while (entries.size > limit) entries.delete(entries.keys().next().value as string);
    notify();
  }

  /**
   * Worker'ı bırakır; bekleyen her iş ana iş parçacığına düşer. Sonraki iş yeni
   * bir worker dener, en çok `MAX_WORKER_RESTARTS` kez: sınır olmasa sürekli
   * düşen bir worker her işte yeniden kurulurdu, sınırsız olmasa da tek bir
   * düşüş oturumun geri kalanında her işi ana iş parçacığına indirirdi.
   */
  function dropWorker() {
    const w = worker;
    restarts++;
    worker = restarts <= MAX_WORKER_RESTARTS ? undefined : null;
    try {
      w?.terminate();
    } catch {
      // Kapatılamayan worker yine de bir daha kullanılmıyor.
    }
    const pending = [...replies.values()];
    replies.clear();
    for (const reply of pending) reply({ id: -1, error: "worker" });
  }

  function getWorker(): WorkerLike | null {
    if (worker !== undefined) return worker;
    try {
      worker = createWorker();
    } catch {
      worker = null;
    }
    if (worker) {
      worker.onmessage = (event) => {
        const data = event?.data as Partial<Reply> | undefined;
        const reply = typeof data?.id === "number" ? replies.get(data.id) : undefined;
        // Çözümlenemeyen mesaj yok sayılıyor; iş zaman aşımında ana iş
        // parçacığına düşer.
        if (!reply || !data) return;
        replies.delete(data.id as number);
        reply(data as Reply);
      };
      worker.onerror = () => dropWorker();
    }
    return worker;
  }

  const runLocal = (job: J) =>
    new Promise<Settled<unknown>>((resolve) => {
      defer(() => {
        try {
          resolve({ ok: true, value: run(job) });
        } catch (e) {
          resolve({ ok: false, error: messageOf(e) });
        }
      });
    });

  const runInWorker = (w: WorkerLike, job: J) =>
    new Promise<Settled<unknown>>((resolve) => {
      const id = ++nextId;
      let finished = false;
      const fallBack = () => void runLocal(job).then(resolve);
      const timer = setTimer(() => {
        if (!finished && replies.has(id)) dropWorker();
      }, timeoutMs);
      replies.set(id, (reply) => {
        if (finished) return;
        finished = true;
        clearTimer(timer);
        if (reply.error === undefined) resolve({ ok: true, value: reply.result });
        else fallBack();
      });
      try {
        w.postMessage({ id, job });
      } catch {
        // Yapılandırılmış kopya hatası ya da kapanmış worker: bu iş ana iş
        // parçacığında koşar.
        if (finished) return;
        finished = true;
        clearTimer(timer);
        replies.delete(id);
        fallBack();
      }
    });

  /** Sonuç ya da hata; reddedilmez. Önbellekte varsa hemen, sürüyorsa ona katılır. */
  function settle<T>(job: J, key: string): Promise<Settled<T>> {
    const entry = entries.get(key);
    if (entry?.state === "done") return Promise.resolve({ ok: true, value: entry.value as T });
    let pending = running.get(key);
    if (!pending) {
      if (entry?.state === "error") {
        entries.delete(key);
        notify();
      }
      const w = getWorker();
      pending = (w ? runInWorker(w, job) : runLocal(job))
        .catch((e): Settled<unknown> => ({ ok: false, error: messageOf(e) }))
        .then((settled) => {
          running.delete(key);
          publish(
            key,
            settled.ok ? { state: "done", value: settled.value } : { state: "error", error: settled.error },
          );
          return settled;
        });
      running.set(key, pending);
    }
    return pending as Promise<Settled<T>>;
  }

  /** Sonuç; hata olursa reddedilir (tıklamayla başlayan işler için). */
  async function compute<T>(job: J, key: string): Promise<T> {
    const settled = await settle<T>(job, key);
    if (!settled.ok) throw new Error(settled.error);
    return settled.value;
  }

  return {
    settle,
    compute,
    snapshot: (key: string): Entry | undefined => entries.get(key),
    isRunning: (key: string) => running.has(key),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type View<T> = {
  value: T | undefined;
  /** Bu girdinin sonucu henüz yok. */
  pending: boolean;
  /** Gösterilen değer başka (önceki) bir girdiye ait. */
  stale: boolean;
  error: string | null;
};

/**
 * Ekranda ne gösterileceği. Yeni girdinin sonucu gelene kadar önceki sonuç
 * görünür ama `stale` işaretli: önceki ayarların sonucu yeni ayarlarınki diye
 * sunulmasın.
 */
export function viewOf<T>(
  key: string | null,
  entry: Entry | undefined,
  shown: { key: string; value: T } | null,
): View<T> {
  if (key === null) return { value: undefined, pending: false, stale: false, error: null };
  if (entry?.state === "done") return { value: entry.value as T, pending: false, stale: false, error: null };
  const stale = shown !== null && shown.key !== key;
  if (entry?.state === "error") return { value: shown?.value, pending: false, stale, error: entry.error };
  return { value: shown?.value, pending: true, stale, error: null };
}
