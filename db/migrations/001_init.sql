CREATE TABLE reports (
  id                 text PRIMARY KEY CHECK (length(id) >= 32),
  formula            text NOT NULL CHECK (formula IN ('A', 'B', 'C')),
  input              jsonb NOT NULL,
  results            jsonb NOT NULL,
  score              integer NOT NULL,
  paid               boolean NOT NULL DEFAULT false,
  paid_at            timestamptz,
  waiver_accepted_at timestamptz,
  ip_hash            text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reports_created_at_idx ON reports (created_at);
CREATE INDEX reports_ip_hash_idx ON reports (ip_hash) WHERE ip_hash IS NOT NULL;

CREATE TABLE payments (
  id           bigserial PRIMARY KEY,
  report_id    text NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  provider     text NOT NULL,
  provider_ref text NOT NULL UNIQUE,
  amount_cents integer NOT NULL,
  currency     text NOT NULL DEFAULT 'EUR',
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

CREATE INDEX payments_report_idx ON payments (report_id);
