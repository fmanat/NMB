"use client";

import { buttonClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { removeReport } from "../actions";

export function ReportActions({ id }: { id: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap no-print">
      <button type="button" onClick={() => window.print()} className={buttonClass({ variant: "secondary", fullOnMobile: true })}>
        <Icon name="download" size={18} />
        <span>Télécharger en PDF</span>
      </button>
      <form
        action={removeReport.bind(null, id)}
        onSubmit={(e) => {
          if (!confirm("Supprimer définitivement ce rapport ? Cette action est irréversible.")) e.preventDefault();
        }}
      >
        <button type="submit" className={buttonClass({ variant: "destructive", fullOnMobile: true })}>
          <Icon name="trash" size={18} />
          <span>Supprimer mon rapport</span>
        </button>
      </form>
    </div>
  );
}
