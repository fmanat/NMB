-- Entonnoir de conversion : événements anonymes (aucun identifiant, aucune adresse IP, aucun cookie, aucun user-agent).
-- Une ligne = un événement ; on ne peut pas relier deux événements au même visiteur : ce sont des comptages, pas des personnes.
CREATE TABLE funnel_events (
  id         bigserial PRIMARY KEY,
  kind       text NOT NULL CHECK (kind IN ('home_view', 'questionnaire_start', 'questionnaire_done', 'report_view', 'card_created', 'locked_preview')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX funnel_events_idx ON funnel_events (kind, created_at);
