-- Cartes de partage : instantané de ce que l'utilisateur a choisi de montrer (aucune image, aucune silhouette).
-- Supprimer le rapport supprime ses cartes.
CREATE TABLE cards (
  id         text PRIMARY KEY CHECK (length(id) >= 16),
  report_id  text NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  content    jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cards_report_idx ON cards (report_id);

-- Défis entre amis : un défi par rapport créateur ; l'ami relève le défi avec son propre rapport payé.
-- Si le rapport de l'ami est effacé (non payé après 24 h), le défi redevient disponible.
CREATE TABLE challenges (
  id                text PRIMARY KEY CHECK (length(id) >= 16),
  creator_report_id text NOT NULL UNIQUE REFERENCES reports (id) ON DELETE CASCADE,
  friend_report_id  text UNIQUE REFERENCES reports (id) ON DELETE SET NULL,
  creator_withdrawn boolean NOT NULL DEFAULT false,
  friend_withdrawn  boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);
