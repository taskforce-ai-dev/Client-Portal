CREATE TABLE IF NOT EXISTS agent_call_events (
  id SERIAL PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  agent_id text,
  source text NOT NULL DEFAULT 'unknown',
  call_sid text,
  caller text,
  duration_seconds int,
  outcome text,
  summary text,
  guest_name text,
  check_in date,
  check_out date,
  room text,
  raw jsonb
);

CREATE INDEX IF NOT EXISTS agent_call_events_received_at_idx ON agent_call_events (received_at DESC);

