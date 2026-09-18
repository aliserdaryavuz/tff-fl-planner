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
  className = "",
}: {
  id?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid min-w-0 gap-2 ${className}`}>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1
          id={id}
          className="m-0 min-w-0 font-cond text-[28px] leading-[1.1] font-bold tracking-wide break-words desk:text-[34px]"
        >
          {title}
        </h1>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {lead ? <p className="m-0 text-[13px] text-muted">{lead}</p> : null}
    </div>
  );
}
