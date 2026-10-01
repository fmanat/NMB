import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { PaymentEvent, PaymentProvider } from "./types";

/**
 * Adaptateur Verotel « FlexPay » (page de paiement hébergée, achat unique, notifications « postback » signées).
 *
 * Sources (voir docs/PRESTATAIRES.md) : le client officiel de Verotel, dépôt public https://github.com/verotel/flexpay-php-client
 * (fichiers src/Verotel/FlexPay/Client.php, Brand/Verotel.php, examples/postback.php) pour l'adresse, la construction de l'URL et la
 * signature ; la bibliothèque tierce pipisco/laravel-verotel-flexpay (PostbackHandler.php, Enums/Event.php, Enums/UrlParameter.php) pour
 * les noms des événements et des paramètres de notification. La documentation officielle FlexPay (controlcenter.verotel.com/flexpay-doc)
 * est derrière une connexion : elle n'a pas pu être lue. Tout ce qui n'est pas dans ces deux sources est marqué « À CONFIRMER » ci-dessous
 * et doit être vérifié en mode test avec le compte Verotel avant tout paiement réel.
 *
 * Désactivé tant que VEROTEL_SHOP_ID et VEROTEL_SIGNATURE_KEY ne sont pas renseignées : toute utilisation lève une erreur claire.
 *
 * Confidentialité : seuls un identifiant de référence aléatoire (référence du paiement), le montant, la devise et un libellé fixe
 * sont envoyés à Verotel. Jamais l'identifiant privé du rapport (qui donne accès au rapport) : le retour du client passe par
 * /paiement/retour, sans paramètre.
 */

export const VEROTEL_PROTOCOL_VERSION = "4";
const DEFAULT_BASE = "https://secure.verotel.com"; // Brand/Verotel.php ; chemin d'achat « /startorder » (Brand/Base.php)

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Verotel désactivé : ${name} n'est pas renseignée.`);
  return v;
}

function base(): string {
  const b = (process.env.VEROTEL_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
  if (!b.startsWith("https://")) throw new Error("Verotel : VEROTEL_BASE_URL doit être en https.");
  return b;
}

/**
 * Signature FlexPay (Client.php, _signature) : hash de « secret:clé1=valeur1:clé2=valeur2… », paramètres triés par nom (ordre des octets),
 * sans le paramètre « signature » ; « shopID » est ajouté s'il manque. SHA-256 (SHA-1 : ancien format, voir verifyPostback).
 */
export function flexpaySignature(params: Record<string, string>, secret: string, shopId: string, alg: "sha256" | "sha1" = "sha256"): string {
  const p: Record<string, string> = { ...params };
  delete p.signature;
  if (p.shopID === undefined) p.shopID = shopId;
  const parts = [secret, ...Object.keys(p).sort().map((k) => `${k}=${p[k]}`)];
  return createHash(alg).update(parts.join(":")).digest("hex");
}

const eq = (a: string, b: string): boolean => {
  const x = Buffer.from(a.toLowerCase());
  const y = Buffer.from(b.toLowerCase());
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Montant « 2.99 » → 299. Refuse tout autre format. */
export function amountToCents(s: string | undefined): number {
  if (!s || !/^\d{1,7}(\.\d{1,2})?$/.test(s)) throw new Error("Montant invalide");
  return Math.round(Number(s) * 100);
}

/** URL d'achat (get_purchase_URL du client officiel) : paramètres non vides, type=purchase, version=4, shopID, signature en dernier. */
export function purchaseUrl(
  p: { priceAmount: string; priceCurrency: string; description: string; referenceID: string; successURL: string; declineURL: string },
  cfg: { shopId: string; secret: string; base?: string },
): string {
  const params: Record<string, string> = { ...p, type: "purchase", version: VEROTEL_PROTOCOL_VERSION, shopID: cfg.shopId };
  const signed: Record<string, string> = {};
  for (const k of Object.keys(params).sort()) if (params[k] !== "") signed[k] = params[k];
  signed.signature = flexpaySignature(signed, cfg.secret, cfg.shopId);
  return `${(cfg.base ?? DEFAULT_BASE).replace(/\/$/, "")}/startorder?${new URLSearchParams(signed).toString()}`;
}

/**
 * Notification (« postback ») : requête GET dont les paramètres sont dans l'adresse. Authentique si la signature (calculée sur tous les
 * paramètres reçus sauf « signature », examples/postback.php) correspond. Le corps brut transmis ici est la chaîne de requête.
 *
 * Événements (Enums/Event.php) pris en compte :
 *  - « initial » : vente acceptée → payment.succeeded. À CONFIRMER : un achat unique peut aussi arriver sans paramètre « event »,
 *    avec « type=purchase » (valeur par défaut de la bibliothèque tierce) ; ce cas est accepté s'il porte un « saleID ».
 *  - « credit » : remboursement (la page de la bibliothèque dit « credited by merchant, Verotel support or by system ») → payment.refunded.
 *  - « chargeback » : contestation bancaire → payment.chargeback.
 *  - tout autre événement (rebill, extend, cancel, expiry…) : authentique mais sans effet (null).
 */
export function verifyPostback(rawQuery: string, cfg: { shopId: string; secret: string; acceptSha1?: boolean }): PaymentEvent | null {
  const q = new URLSearchParams(rawQuery.replace(/^\?/, ""));
  const params: Record<string, string> = {};
  for (const [k, v] of q) {
    if (k in params) throw new Error("Paramètre répété"); // ambigu : refusé
    params[k] = v;
  }
  const given = params.signature;
  if (!given) throw new Error("Signature absente");
  const sig256 = flexpaySignature(params, cfg.secret, cfg.shopId);
  const ok = eq(given, sig256) || (cfg.acceptSha1 === true && eq(given, flexpaySignature(params, cfg.secret, cfg.shopId, "sha1")));
  if (!ok) throw new Error("Signature invalide");
  if (params.shopID !== undefined && params.shopID !== cfg.shopId) throw new Error("shopID inattendu");

  const event = params.event;
  const saleId = params.saleID || undefined;
  const refund = event === "credit";
  const chargeback = event === "chargeback";
  const success = event === "initial" || (event === undefined && params.type === "purchase" && saleId !== undefined);
  if (!refund && !chargeback && !success) return null;

  const providerRef = params.referenceID ?? "";
  if (success && !providerRef) throw new Error("referenceID absent");
  if ((refund || chargeback) && !providerRef && !saleId) throw new Error("Aucune référence de vente");

  let amountCents = 0;
  let currency = "";
  const a = params.priceAmount ?? params.amount;
  const c = params.priceCurrency ?? params.currency;
  if (success) {
    // Si les deux noms de paramètre sont présents, ils doivent concorder.
    if (params.priceAmount !== undefined && params.amount !== undefined && amountToCents(params.priceAmount) !== amountToCents(params.amount)) throw new Error("Montants incohérents");
    amountCents = amountToCents(a);
    if (!c || !/^[A-Za-z]{3}$/.test(c)) throw new Error("Devise invalide");
    currency = c.toUpperCase();
  } else if (a !== undefined && c !== undefined) {
    try {
      amountCents = amountToCents(a);
      currency = c.toUpperCase();
    } catch {
      /* non utilisé pour un remboursement */
    }
  }
  return { type: success ? "payment.succeeded" : refund ? "payment.refunded" : "payment.chargeback", providerRef, saleId, amountCents, currency };
}

export const verotelProvider: PaymentProvider = {
  id: "verotel",

  async createCheckout({ reportId, amountCents, currency }) {
    const shopId = need("VEROTEL_SHOP_ID");
    const secret = need("VEROTEL_SIGNATURE_KEY");
    const site = need("SITE_URL").replace(/\/$/, "");
    const providerRef = "nmb_" + randomBytes(16).toString("hex");
    void reportId; // volontairement NON transmis à Verotel (voir l'en-tête du fichier)
    const redirectUrl = purchaseUrl(
      {
        priceAmount: (amountCents / 100).toFixed(2),
        priceCurrency: currency,
        description: "Rapport d'analyse Bitomètre",
        referenceID: providerRef,
        successURL: `${site}/paiement/retour`,
        declineURL: `${site}/paiement/retour?echec=1`,
      },
      { shopId, secret, base: base() },
    );
    return { providerRef, redirectUrl };
  },

  verifyWebhook(rawBody) {
    return verifyPostback(rawBody, { shopId: need("VEROTEL_SHOP_ID"), secret: need("VEROTEL_SIGNATURE_KEY"), acceptSha1: process.env.VEROTEL_ACCEPT_SHA1 === "on" });
  },
};
