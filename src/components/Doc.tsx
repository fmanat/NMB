export function Doc({ title, children, draft = false }: { title: string; children: React.ReactNode; draft?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 prose-lab">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {draft && (
        <p className="mt-3 text-sm border border-accent-2/50 rounded-lg px-3 py-2 !text-accent-2">
          Brouillon interne : à compléter et à faire relire avant publication.
        </p>
      )}
      {children}
    </div>
  );
}
