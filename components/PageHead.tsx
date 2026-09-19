/**
 * Sayfa başlığı şablonu: her rotada tek `h1`, altında kısa açıklama, sağda
 * sayfa eylemleri (görsel kaydetme gibi).
 *
 * Site adı artık `h1` değil — üst çubukta ana sayfa bağlantısı olarak duruyor.
 * Böylece başlık listesinde her sayfa kendi adıyla başlıyor. Eylemler dar
 * ekranda başlığın altına sarılır; satır en az 44 px, sonradan gelen düğme
 * başlığı itmesin.
 */
export function PageHead({
  id = "page-heading",
  title,
  lead,
  actions,
  context,
  className = "",
}: {
  id?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  /** Bağlam çipleri (`ContextBar`), açıklamanın altında. */
  context?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid min-w-0 gap-2 ${className}`}>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1
          id={id}
          // Rol ölçeği duyarlı değil: masaüstünde büyümek yerine çok dar ekranda
          // iniyor (UCL deseni). Masaüstü başlığı 34 px'ten 28'e indi.
          className="m-0 min-w-0 font-cond text-display font-bold tracking-wide break-words max-[20rem]:text-title"
        >
          {title}
        </h1>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {lead ? <p className="m-0 text-label text-muted">{lead}</p> : null}
      {context}
    </div>
  );
}
