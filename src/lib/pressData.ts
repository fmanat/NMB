import { REFERENCE_SOURCE, SITE } from "@/config/site";

// Mention de source des graphiques et des chiffres de la page presse (texte à reprendre tel quel).
export const PRESS_CREDIT = `Source : ${SITE.name} (${SITE.domain}), d'après ${REFERENCE_SOURCE}`;

const base = (process.env.SITE_URL ?? `https://${SITE.domain}`).replace(/\/$/, "");

/** Version avec lien, à coller dans une page web. */
export const PRESS_CREDIT_HTML = `Source : <a href="${base}/percentile-penis">${SITE.name}</a>, d'après Veale et al., BJU International, 2015`;
