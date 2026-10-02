import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Les demandes à envoyer (docs/DEMANDES) : un fichier par destinataire, structure complète, aucune information inventée.
const FILES = ["verotel", "ccbill", "segpay", "railway", "ageverif", "yoti", "microsoft-photodna", "xai"] as const;
const read = (n: string) => readFileSync(`docs/DEMANDES/${n}.md`, "utf8");

describe("demandes à envoyer", () => {
  it("un fichier par destinataire, plus le récapitulatif qui les cite tous", () => {
    const readme = read("README");
    for (const f of FILES) {
      expect(existsSync(`docs/DEMANDES/${f}.md`), f).toBe(true);
      expect(readme, f).toContain(`${f}.md`);
    }
  });

  it.each(FILES)("%s : en tête, indication « nécessaire pour le passage au payant de la formule A » (OUI ou NON)", (f) => {
    const head = read(f).split("\n").slice(0, 4).join("\n");
    expect(head).toMatch(/Nécessaire pour le passage au payant de la formule A : (\*\*)?(OUI|NON)/);
  });

  it.each(FILES)("%s : canal d'envoi avec lien, objet, message prêt à copier, informations à joindre, questions à réponse écrite", (f) => {
    const t = read(f);
    for (const h of ["## Canal d'envoi", "## Objet", "## Message prêt à copier", "## Informations à joindre", "## Questions appelant une réponse écrite"]) expect(t, h).toContain(h);
    expect(t).toMatch(/\]\(https?:\/\/|<https?:\/\//);
    expect(t).toMatch(/^> 1\. /m); // des questions numérotées dans le message
  });

  it.each(FILES)("%s : signé au nom de la Ltd avec marqueurs à compléter ; aucune adresse e-mail ni numéro inventés", (f) => {
    const t = read(f);
    expect(t).toMatch(/\[À COMPLÉTER : (legal name of the Ltd|raison sociale de la Ltd)\]/);
    expect(t).toMatch(/\[À COMPLÉTER : (name of the director|nom du signataire)\]/);
    expect(t).not.toMatch(/[\w.-]+@[\w-]+\.[a-z]{2,}/i);
    expect(t).not.toMatch(/\b\d{8}\b/); // pas de numéro Companies House inventé
  });

  it("langue : tous en anglais sauf AgeVerif en français", () => {
    const msg = (f: string) => read(f).split("## Message prêt à copier")[1].split("## Informations à joindre")[0];
    expect(msg("ageverif")).toMatch(/Bonjour/);
    expect(msg("ageverif")).not.toMatch(/Dear |Hello|Kind regards/);
    for (const f of FILES.filter((x) => x !== "ageverif")) {
      expect(msg(f), f).toMatch(/Hello|Dear /);
      expect(msg(f), f).not.toMatch(/Bonjour|Cordialement/);
    }
  });

  it("description honnête : photo d'anatomie intime, analyse en mémoire, non stockée, formules photo pas encore ouvertes", () => {
    for (const f of FILES) {
      const t = read(f).toLowerCase();
      if (f === "xai" || f === "microsoft-photodna" || f === "yoti" || f === "ageverif" || f === "railway" || f === "verotel") {
        expect(t, f).toMatch(/not (yet )?live|pas encore ouvertes?|not yet|pas encore/);
        expect(t, f).toMatch(/memory|mémoire/);
      }
    }
    expect(read("verotel")).toMatch(/does \*\*not\*\* display/);
  });

  it("aucun message prêt à copier n'affirme une garantie que le filtrage d'empreintes ou la vérification d'âge ne donne pas", () => {
    for (const f of FILES) {
      const msg = read(f).split("## Message prêt à copier")[1].split("## Informations à joindre")[0];
      expect(msg, f).not.toMatch(/mineurs détectés|minors? (are )?detected|detects? (the )?age|illegal content (is )?blocked|contenus illicites bloqués/i);
    }
  });
});
