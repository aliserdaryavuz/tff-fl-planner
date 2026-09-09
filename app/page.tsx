import { Suspense } from "react";
import { Shell } from "@/components/Shell";

export default function Page() {
  return (
    <div className="mx-auto max-w-[1040px] px-3.5 pt-3.5 pb-10">
      {/* Shell adres çubuğundaki durumu okuyor; bu yüzden Suspense içinde. */}
      <Suspense fallback={<p className="text-[13px] text-muted">…</p>}>
        <Shell />
      </Suspense>
    </div>
  );
}
