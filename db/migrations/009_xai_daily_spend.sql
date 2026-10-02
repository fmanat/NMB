-- Plafond de dépense xAI quotidien (bloc 6, session de nuit 4) : agrégats par jour civil (Europe/Paris), aucune donnée personnelle.
-- Montants en micro-dollars (entiers) : coût estimé d'après les jetons consommés × tarif configuré (XAI_PRICE_IN_PER_M, XAI_PRICE_OUT_PER_M).
--   reserved_micros : réservations des analyses en cours (prises AVANT d'appeler le modèle, rendues à la fin) ;
--   spent_micros    : coût des appels terminés ; calls : nombre d'appels au modèle ; analyses : analyses ayant appelé le modèle.
CREATE TABLE xai_daily_spend (
  day             date PRIMARY KEY,
  reserved_micros bigint  NOT NULL DEFAULT 0 CHECK (reserved_micros >= 0),
  spent_micros    bigint  NOT NULL DEFAULT 0 CHECK (spent_micros >= 0),
  calls           integer NOT NULL DEFAULT 0,
  analyses        integer NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
