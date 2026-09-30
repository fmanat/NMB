-- Captcha à preuve de travail (ALTCHA) : mémoire des défis déjà utilisés, pour refuser le rejeu d'une solution.
-- Ne contient ni adresse IP, ni donnée personnelle : seulement la signature (aléatoire) du défi et sa date d'expiration.
CREATE TABLE captcha_used (
  signature  text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);
CREATE INDEX captcha_used_expires_idx ON captcha_used (expires_at);
