-- Bêta gratuite : un rapport créé en mode bêta est débloqué sans paiement.
-- Le drapeau permet d'exclure ces rapports des statistiques de conversion et de les purger au bout de BETA.reportTtlDays jours.
ALTER TABLE reports ADD COLUMN free_beta boolean NOT NULL DEFAULT false;
ALTER TABLE report_log ADD COLUMN free_beta boolean NOT NULL DEFAULT false;
CREATE INDEX reports_free_beta_idx ON reports (created_at) WHERE free_beta;
