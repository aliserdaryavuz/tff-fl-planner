"use client";

export function Badge({
  children,
  color,
  title,
}: {
  children: React.ReactNode;
  color?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-block rounded-full border px-2 py-px text-caption font-semibold text-ink"
      style={{ borderColor: color ?? "var(--color-line)" }}
    >
      {children}
    </span>
  );
}
