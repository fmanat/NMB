"use client";

import { removeReport } from "../actions";

export function ReportActions({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      <button type="button" onClick={() => window.print()} className="panel px-4 py-2 text-sm hover:border-accent">
        Télécharger en PDF
      </button>
      <form
        action={removeReport.bind(null, id)}
        onSubmit={(e) => {
          if (!confirm("Supprimer définitivement ce rapport ? Cette action est irréversible.")) e.preventDefault();
        }}
      >
        <button type="submit" className="panel px-4 py-2 text-sm text-accent-2 hover:border-accent-2">
          Supprimer mon rapport
        </button>
      </form>
    </div>
  );
}
