-- Étape 6 : administration et statistiques durables.
-- Tout ce qui suit est anonyme : aucun identifiant de rapport en clair, aucune donnée d'identité, aucune image.

-- 1. Paiements : conservés même si le rapport est supprimé (obligations comptables).
ALTER TABLE payments ALTER COLUMN report_id DROP NOT NULL;
ALTER TABLE payments DROP CONSTRAINT payments_report_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_report_id_fkey FOREIGN KEY (report_id) REFERENCES reports (id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN formula text;
UPDATE payments p SET formula = r.formula FROM reports r WHERE r.id = p.report_id;
CREATE INDEX payments_confirmed_idx ON payments (confirmed_at) WHERE status = 'succeeded';

-- 2. Journal des rapports : une ligne par rapport créé, conservée après suppression ou purge du rapport.
--    La clé est l'empreinte SHA-256 de l'identifiant privé : elle permet de marquer le paiement sans conserver l'identifiant.
CREATE TABLE report_log (
  key        text PRIMARY KEY,
  formula    text NOT NULL CHECK (formula IN ('A', 'B', 'C')),
  score      integer NOT NULL,
  created_at timestamptz NOT NULL,
  paid_at    timestamptz
);
CREATE INDEX report_log_created_idx ON report_log (created_at);
CREATE INDEX report_log_paid_idx ON report_log (paid_at) WHERE paid_at IS NOT NULL;

INSERT INTO report_log (key, formula, score, created_at, paid_at)
SELECT encode(sha256(convert_to(id, 'UTF8')), 'hex'), formula, score, created_at, paid_at FROM reports;

-- 3. Événements de défi (créés, relevés) : le défi lui-même disparaît avec le rapport.
CREATE TABLE stat_events (
  id         bigserial PRIMARY KEY,
  kind       text NOT NULL CHECK (kind IN ('challenge_created', 'challenge_taken')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stat_events_idx ON stat_events (kind, created_at);

-- 4. Envois quotidiens du webhook d'agrégats : un seul envoi réussi par jour.
CREATE TABLE webhook_deliveries (
  day     date PRIMARY KEY,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status  integer NOT NULL
);
