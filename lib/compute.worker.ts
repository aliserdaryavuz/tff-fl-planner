import { type Job, runJob } from "@/lib/compute-jobs";

// Kadro hesabının worker girişi. Hesap `lib/compute-jobs.ts`'te; burada yalnız
// mesaj alışverişi var. Hata olursa ana iş parçacığı aynı hesabı kendisi yapıyor
// (`lib/compute-store.ts`).
const ctx = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<{ id: number; job: Job }>) => void,
  ): void;
};

ctx.addEventListener("message", (event) => {
  const { id, job } = event.data;
  try {
    ctx.postMessage({ id, result: runJob(job) });
  } catch (error) {
    ctx.postMessage({ id, error: String(error) });
  }
});
