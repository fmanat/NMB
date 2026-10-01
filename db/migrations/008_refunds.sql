-- Remboursements et contestations (Verotel : événements « credit » et « chargeback ») : le rapport se reverrouille.
ALTER TABLE payments DROP CONSTRAINT payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'disputed'));
-- Numéro de vente chez le prestataire (utile quand une notification de remboursement ne porte que lui).
ALTER TABLE payments ADD COLUMN provider_sale_id text;
CREATE INDEX payments_sale_idx ON payments (provider_sale_id) WHERE provider_sale_id IS NOT NULL;
ALTER TABLE payments ADD COLUMN refunded_at timestamptz;
-- Un rapport reverrouillé est conservé 30 jours (au lieu de 24 h) avant purge : le client peut s'adresser au support.
ALTER TABLE reports ADD COLUMN relocked_at timestamptz;
