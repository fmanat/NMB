-- Tentatives d'analyse (formules photo) : limitation de débit, refus par motif, coût IA.
-- Aucune image, aucune donnée d'identité. L'adresse IP hachée est effacée après 24 h ; le reste sert aux statistiques.
CREATE TABLE analysis_attempts (
  id         bigserial PRIMARY KEY,
  ip_hash    text,
  formula    text NOT NULL CHECK (formula IN ('B', 'C')),
  outcome    text NOT NULL DEFAULT 'started' CHECK (outcome IN ('started', 'ok', 'refused', 'blocked', 'error')),
  motif      text,
  vision_ms  integer,
  tokens_in  integer,
  tokens_out integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX analysis_attempts_ip_idx ON analysis_attempts (ip_hash) WHERE ip_hash IS NOT NULL;
CREATE INDEX analysis_attempts_created_idx ON analysis_attempts (created_at);
