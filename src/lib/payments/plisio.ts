import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { PaymentEvent, PaymentProvider } from "./types";

/**
 * Adaptateur Plisio (paiement en cryptomonnaie, page de paiement hébergée par Plisio).
 *
 * Source : documentation publique de Plisio, lue le 04/10/2026 :
 *  - https://plisio.net/documentation/endpoints/create-an-invoice : création de facture (GET https://api.plisio.net/api/v1/invoices/new),
 *    champs de la requête, réponse { status, data: { txn_id, invoice_url } }, statuts et champs de la notification (« callback »),
 *    vérification de la notification ;
 *  - https://plisio.net/documentation/getting-started/setting-shop : réglages de la boutique (Status URL, monnaies, tolérance de
 *    sous-paiement « Underpayment allowed % ») ;
 *  - https://plisio.net/documentation/appendices/supported-cryptocurrencies : identifiants des monnaies.
 *
 * Création : facture en euros (source_currency=EUR, source_amount), numéro de commande aléatoire (order_number, unique par commande,
 * exigé par Plisio), monnaies limitées par allowed_psys_cids, adresse de notification (callback_url) avec « json=true » (la
 * documentation l'exige hors PHP : la notification arrive alors en JSON), boutons de retour vers le site (success_invoice_url,
 * fail_invoice_url). Aucune adresse e-mail, aucun identifiant de rapport n'est transmis : le retour passe par /paiement/retour.
 *
 * Notification : authentique si verify_hash = HMAC-SHA1, avec la clé secrète, du JSON de la notification sans verify_hash (exemple Node
 * de la documentation : JSON.stringify de l'objet reçu, dans l'ordre reçu). Statuts :
 *  - « completed » (payé intégralement, ou sous-payé dans la tolérance réglée dans le tableau de bord) → payment.succeeded ;
 *  - « expired », « cancelled », « error » → payment.failed : rien n'est débloqué ;
 *  - « new », « pending », « pending internal », « cancelled duplicate » (facture remplacée quand le client change de monnaie ; la
 *    nouvelle facture garde le même numéro de commande) et tout autre statut → authentiques mais sans effet.
 * Le montant contrôlé est celui de la facture en euros (source_amount, source_currency) : il doit être celui du rapport.
 *
 * Désactivé tant que PLISIO_SECRET_KEY est vide : toute utilisation lève une erreur claire.
 */

export const PLISIO_API = "https://api.plisio.net/api/v1/invoices/new";
/**
 * Monnaies proposées à chaque facture (identifiants Plisio) : USDT et USDC sur Ethereum, USDT sur Tron (USDT_TRX), USDC sur Solana
 * (USDC_SOL), SOL sur Solana. Décision du propriétaire du 04/10/2026 (Tron et Solana : frais de réseau très faibles).
 */
export const PLISIO_CURRENCIES = ["BTC", "ETH", "USDT", "USDC", "USDT_TRX", "USDC_SOL", "LTC", "SOL"] as const;
/** Adresse de notification sur le site (relative à SITE_URL). */
export const PLISIO_CALLBACK_PATH = "/api/paiement/plisio";

const SUCCESS = new Set(["completed"]);
const FAILED = new Set(["expired", "cancelled", "error"]);

export const plisioConfigured = (env: Record<string, string | undefined> = process.env): boolean => (env.PLISIO_SECRET_KEY ?? "").trim() !== "";

function secret(): string {
  const k = (process.env.PLISIO_SECRET_KEY ?? "").trim();
  if (!k) throw new Error("Plisio désactivé : PLISIO_SECRET_KEY n'est pas renseignée.");
  return k;
}

function site(): string {
  const s = (process.env.SITE_URL ?? "").replace(/\/$/, "");
  if (!s) throw new Error("Plisio : SITE_URL n'est pas renseignée.");
  return s;
}

/** Numéro de commande : 15 chiffres aléatoires (Plisio demande un « numéro » unique par commande). */
export function newOrderNumber(): string {
  return String(randomInt(1, 10)) + Array.from({ length: 14 }, () => randomInt(0, 10)).join("");
}

/** Paramètres de la requête de création de facture (sans la clé), exposés pour les tests. */
export function invoiceParams(p: { orderNumber: string; amountCents: number; currency: string; siteUrl: string }): Record<string, string> {
  return {
    source_currency: p.currency,
    source_amount: (p.amountCents / 100).toFixed(2),
    order_number: p.orderNumber,
    order_name: "Rapport Bitomètre",
    description: "Rapport d'analyse Bitomètre",
    allowed_psys_cids: PLISIO_CURRENCIES.join(","),
    callback_url: `${p.siteUrl}${PLISIO_CALLBACK_PATH}?json=true`,
    success_invoice_url: `${p.siteUrl}/paiement/retour`,
    fail_invoice_url: `${p.siteUrl}/paiement/retour?echec=1`,
  };
}

/** HMAC-SHA1 de la notification sans verify_hash, comme l'exemple Node de la documentation. */
export function plisioHash(data: Record<string, unknown>, key: string): string {
  const ordered: Record<string, unknown> = { ...data };
  delete ordered.verify_hash;
  return createHmac("sha1", key).update(JSON.stringify(ordered)).digest("hex");
}

/** Montant en euros (chaîne ou nombre, « 4.99 ») → centimes. Refuse tout autre format. */
export function eurToCents(v: unknown): number {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  if (!/^\d{1,7}(\.\d{1,8})?$/.test(s)) throw new Error("Montant invalide");
  return Math.round(Number(s) * 100);
}

/** Vérifie une notification (corps JSON brut) et la traduit en événement de paiement, ou null si elle est sans effet. */
export function verifyPlisioCallback(rawBody: string, key: string): PaymentEvent | null {
  let data: unknown;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error("Notification illisible");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Notification illisible");
  const d = data as Record<string, unknown>;
  const given = typeof d.verify_hash === "string" ? d.verify_hash.toLowerCase() : "";
  if (!given) throw new Error("Signature absente");
  const expected = plisioHash(d, key);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Signature invalide");

  if (d.ipn_type !== undefined && d.ipn_type !== "invoice") return null;
  const status = typeof d.status === "string" ? d.status : "";
  const success = SUCCESS.has(status);
  const failed = FAILED.has(status);
  if (!success && !failed) return null;

  const providerRef = d.order_number === undefined || d.order_number === null ? "" : String(d.order_number);
  if (!providerRef) throw new Error("order_number absent");
  const saleId = typeof d.txn_id === "string" && d.txn_id ? d.txn_id : undefined;
  if (failed) return { type: "payment.failed", providerRef, saleId, amountCents: 0, currency: "" };

  const currency = typeof d.source_currency === "string" ? d.source_currency.toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Devise de la facture absente");
  return { type: "payment.succeeded", providerRef, saleId, amountCents: eurToCents(d.source_amount), currency };
}

type Fetch = typeof fetch;

export async function createPlisioInvoice(
  p: { amountCents: number; currency: string },
  deps: { fetch?: Fetch; key?: string; siteUrl?: string } = {},
): Promise<{ providerRef: string; redirectUrl: string; txnId: string }> {
  const key = deps.key ?? secret();
  const orderNumber = newOrderNumber();
  const params = invoiceParams({ orderNumber, amountCents: p.amountCents, currency: p.currency, siteUrl: deps.siteUrl ?? site() });
  const url = `${PLISIO_API}?${new URLSearchParams({ ...params, api_key: key }).toString()}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  let body: unknown;
  const t0 = Date.now();
  try {
    const res = await (deps.fetch ?? fetch)(url, { method: "GET", signal: ctl.signal, headers: { accept: "application/json" } });
    body = await res.json().catch(() => null);
  } catch (e) {
    // Journal sans l'adresse appelée (elle contient la clé) : seulement le type d'erreur et la durée.
    const err = e as Error & { cause?: { code?: string } };
    console.error(JSON.stringify({ event: "plisio_unreachable", error: err.name, code: err.cause?.code ?? null, ms: Date.now() - t0 }));
    throw new Error("Plisio injoignable");
  } finally {
    clearTimeout(timer);
  }
  const b = body as { status?: string; data?: { txn_id?: string; invoice_url?: string; message?: string } } | null;
  if (!b || b.status !== "success" || !b.data?.invoice_url || !b.data.txn_id) {
    // Le message d'erreur de Plisio est journalisé (jamais la clé, qui n'apparaît pas dans la réponse).
    console.error(JSON.stringify({ event: "plisio_refused", message: b?.data?.message ?? "réponse inattendue", code: (b?.data as { code?: number } | undefined)?.code ?? null }));
    throw new Error("Plisio a refusé la création de la facture");
  }
  const invoice = new URL(b.data.invoice_url);
  if (invoice.protocol !== "https:" || !(invoice.hostname === "plisio.net" || invoice.hostname.endsWith(".plisio.net"))) {
    throw new Error("Adresse de facture Plisio inattendue");
  }
  return { providerRef: orderNumber, redirectUrl: invoice.toString(), txnId: b.data.txn_id };
}

export const plisioProvider: PaymentProvider = {
  id: "plisio",
  async createCheckout({ reportId, amountCents, currency }) {
    void reportId; // volontairement NON transmis à Plisio (voir l'en-tête du fichier)
    const { providerRef, redirectUrl } = await createPlisioInvoice({ amountCents, currency });
    return { providerRef, redirectUrl };
  },
  verifyWebhook(rawBody) {
    return verifyPlisioCallback(rawBody, secret());
  },
};
