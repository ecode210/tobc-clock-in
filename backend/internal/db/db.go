// Package db owns the local SQLite database: schema, models, and queries.
package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"time"

	_ "modernc.org/sqlite"
)

// LocalDateFormat and LocalDateTimeFormat are laptop-local formats for clock-ins.
const (
	LocalDateFormat     = "2006-01-02"
	LocalDateTimeFormat = "2006-01-02 15:04:05"
)

const schema = `
CREATE TABLE IF NOT EXISTS admins (
	id            TEXT PRIMARY KEY,
	username      TEXT NOT NULL,
	password_hash TEXT NOT NULL,
	is_super      INTEGER NOT NULL DEFAULT 0,
	created_at    TEXT NOT NULL,
	updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workers (
	id                TEXT PRIMARY KEY,
	name              TEXT NOT NULL,
	department        TEXT NOT NULL DEFAULT '',
	username          TEXT NOT NULL,
	setup_code        TEXT NOT NULL,
	device_token      TEXT NULL,
	mac_address       TEXT NULL,
	registered_at     TEXT NULL,
	created_at        TEXT NOT NULL,
	updated_at        TEXT NOT NULL,
	device_updated_at TEXT NULL,
	device_dirty      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_workers_username ON workers(username COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_workers_device_token ON workers(device_token);
CREATE INDEX IF NOT EXISTS idx_workers_mac_address ON workers(mac_address);

CREATE TABLE IF NOT EXISTS clock_ins (
	id              TEXT PRIMARY KEY,
	worker_id       TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
	clock_in_date   TEXT NOT NULL,
	clocked_in_at   TEXT NOT NULL,
	ip_address      TEXT NULL,
	mac_address     TEXT NULL,
	synced_to_cloud INTEGER NOT NULL DEFAULT 0,
	created_at      TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_daily_clockin ON clock_ins(worker_id, clock_in_date);
CREATE INDEX IF NOT EXISTS idx_clock_ins_unsynced ON clock_ins(synced_to_cloud);

CREATE TABLE IF NOT EXISTS sync_state (
	id                INTEGER PRIMARY KEY CHECK (id = 1),
	last_attempt_at   TEXT NULL,
	last_success_at   TEXT NULL,
	last_error        TEXT NULL,
	pending_clock_ins INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO sync_state (id) VALUES (1);
`

// DB wraps the SQLite handle.
type DB struct {
	*sql.DB
}

// Querier is satisfied by *sql.DB, *sql.Tx and *DB.
type Querier interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// Open opens (creating if needed) the database at path and applies the schema.
func Open(path string) (*DB, error) {
	q := url.Values{}
	q.Add("_pragma", "journal_mode(WAL)")
	q.Add("_pragma", "foreign_keys(ON)")
	q.Add("_pragma", "busy_timeout(5000)")
	dsn := "file:" + path + "?" + q.Encode()
	sqlDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	// A single connection serialises writers; callers must not nest pool
	// queries inside an open transaction.
	sqlDB.SetMaxOpenConns(1)
	if _, err := sqlDB.Exec(schema); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	return &DB{sqlDB}, nil
}

// NowUTC formats t as an RFC3339 UTC string.
func NowUTC(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}

// NormalizeTimestamp parses an RFC3339 timestamp and re-formats it in UTC,
// keeping sub-second precision when present. Invalid input is returned as is.
func NormalizeTimestamp(s string) string {
	t, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		return s
	}
	return t.UTC().Format(time.RFC3339Nano)
}

// ParseTimestamp parses a nullable RFC3339 timestamp.
func ParseTimestamp(ns sql.NullString) (time.Time, bool) {
	if !ns.Valid || ns.String == "" {
		return time.Time{}, false
	}
	t, err := time.Parse(time.RFC3339Nano, ns.String)
	if err != nil {
		return time.Time{}, false
	}
	return t, true
}

// IsNewer reports whether a is strictly newer than b; null is the oldest value.
func IsNewer(a, b sql.NullString) bool {
	ta, okA := ParseTimestamp(a)
	tb, okB := ParseTimestamp(b)
	switch {
	case !okA:
		return false
	case !okB:
		return true
	default:
		return ta.After(tb)
	}
}

// Null converts a string to a NullString, treating "" as NULL.
func Null(s string) sql.NullString {
	return sql.NullString{String: s, Valid: s != ""}
}

// NullPtr converts a *string to a NullString.
func NullPtr(s *string) sql.NullString {
	if s == nil {
		return sql.NullString{}
	}
	return Null(*s)
}

// Ptr converts a NullString to a *string.
func Ptr(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	s := ns.String
	return &s
}

// ErrNotFound is returned when a row does not exist.
var ErrNotFound = errors.New("not found")
