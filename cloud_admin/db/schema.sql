-- Cloud admin schema. Idempotent: applied automatically on first database use.
-- Timestamps are truncated to whole seconds so values round-trip exactly through
-- the RFC3339 (second precision) sync API used by the church laptop.

CREATE TABLE IF NOT EXISTS admins (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_super      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT date_trunc('second', now()),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT date_trunc('second', now())
);

CREATE TABLE IF NOT EXISTS workers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL,
    department        TEXT NOT NULL DEFAULT '',
    username          TEXT NOT NULL UNIQUE,
    setup_code        TEXT NOT NULL,
    device_token      TEXT UNIQUE,
    mac_address       TEXT UNIQUE,
    registered_at     TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT date_trunc('second', now()),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT date_trunc('second', now()),
    device_updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workers_department ON workers (department);

CREATE TABLE IF NOT EXISTS clock_ins (
    id              UUID PRIMARY KEY,
    worker_id       UUID NOT NULL REFERENCES workers (id) ON DELETE CASCADE,
    clock_in_date   TEXT NOT NULL,          -- 'YYYY-MM-DD' laptop local date
    clocked_in_at   TEXT NOT NULL,          -- 'YYYY-MM-DD HH:MM:SS' laptop local, verbatim
    ip_address      TEXT NOT NULL DEFAULT '',
    mac_address     TEXT NOT NULL DEFAULT '',
    synced_to_cloud BOOLEAN NOT NULL DEFAULT TRUE,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_daily_clockin ON clock_ins (worker_id, clock_in_date);
CREATE INDEX IF NOT EXISTS idx_clock_ins_date ON clock_ins (clock_in_date);

CREATE TABLE IF NOT EXISTS sync_status (
    id                SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_heartbeat_at TIMESTAMPTZ,
    pending_clock_ins INTEGER NOT NULL DEFAULT 0,
    last_success_at   TIMESTAMPTZ,
    sync_requested_at TIMESTAMPTZ,
    client_version    TEXT
);

INSERT INTO sync_status (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_settings (
    id             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    on_time_cutoff TEXT NOT NULL DEFAULT '07:30',   -- 'HH:MM' laptop local
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT date_trunc('second', now())
);

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
