package db

import (
	"context"
	"database/sql"
	"errors"
	"strings"
)

// ClockIn is a row in the clock_ins table.
type ClockIn struct {
	ID            string
	WorkerID      string
	ClockInDate   string
	ClockedInAt   string
	IPAddress     sql.NullString
	MACAddress    sql.NullString
	SyncedToCloud bool
	CreatedAt     string
}

const clockInColumns = `id, worker_id, clock_in_date, clocked_in_at, ip_address, mac_address, synced_to_cloud, created_at`

func scanClockIn(row interface{ Scan(...any) error }) (*ClockIn, error) {
	var c ClockIn
	var synced int
	err := row.Scan(&c.ID, &c.WorkerID, &c.ClockInDate, &c.ClockedInAt, &c.IPAddress, &c.MACAddress, &synced, &c.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	c.SyncedToCloud = synced != 0
	return &c, nil
}

// InsertClockIn inserts c unless the worker already clocked in on that date.
// It returns the stored row and whether it was newly inserted.
func InsertClockIn(ctx context.Context, q Querier, c *ClockIn) (*ClockIn, bool, error) {
	res, err := q.ExecContext(ctx, `INSERT INTO clock_ins (`+clockInColumns+`)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (worker_id, clock_in_date) DO NOTHING`,
		c.ID, c.WorkerID, c.ClockInDate, c.ClockedInAt, c.IPAddress, c.MACAddress, boolInt(c.SyncedToCloud), c.CreatedAt)
	if err != nil {
		return nil, false, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return nil, false, err
	}
	stored, err := ClockInForDate(ctx, q, c.WorkerID, c.ClockInDate)
	if err != nil {
		return nil, false, err
	}
	return stored, n > 0, nil
}

// ClockInForDate returns the worker's clock-in on the given local date.
func ClockInForDate(ctx context.Context, q Querier, workerID, date string) (*ClockIn, error) {
	return scanClockIn(q.QueryRowContext(ctx,
		`SELECT `+clockInColumns+` FROM clock_ins WHERE worker_id = ? AND clock_in_date = ?`, workerID, date))
}

// UnsyncedClockIns returns all clock-ins not yet accepted by the cloud.
func UnsyncedClockIns(ctx context.Context, q Querier) ([]*ClockIn, error) {
	rows, err := q.QueryContext(ctx,
		`SELECT `+clockInColumns+` FROM clock_ins WHERE synced_to_cloud = 0 ORDER BY clocked_in_at, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*ClockIn
	for rows.Next() {
		c, err := scanClockIn(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// MarkClockInsSynced sets synced_to_cloud = 1 for the given ids.
func MarkClockInsSynced(ctx context.Context, q Querier, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	_, err := q.ExecContext(ctx, `UPDATE clock_ins SET synced_to_cloud = 1 WHERE id IN (`+placeholders+`)`, args...)
	return err
}

// PendingClockInCount counts clock-ins waiting for upload.
func PendingClockInCount(ctx context.Context, q Querier) (int, error) {
	var n int
	err := q.QueryRowContext(ctx, `SELECT COUNT(*) FROM clock_ins WHERE synced_to_cloud = 0`).Scan(&n)
	return n, err
}
