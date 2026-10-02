export function Doc({ title, children, draft = false, wide = false }: { title: string; children: React.ReactNode; draft?: boolean; wide?: boolean }) {
  return (
    <div className={`container-bm ${wide ? "" : "container-narrow"} py-10 md:py-16 prose-lab`}>
      <h1 className="t-h1 !text-[30px] !leading-[34px] md:!text-[40px] md:!leading-[44px]">{title}</h1>
      {draft && (
        <p className="mt-4 text-sm border border-[#f0d9a8] bg-[var(--bm-warning-soft)] rounded-[10px] px-4 py-3 !text-[var(--bm-warning-text)]">
          Brouillon interne : à compléter avant publication.
        </p>
      )}
      {children}
    </div>
  );
}
