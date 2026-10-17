package db

import (
	"context"
	"database/sql"
)

// SyncState is the single-row local sync status.
type SyncState struct {
	LastAttemptAt   sql.NullString
	LastSuccessAt   sql.NullString
	LastError       sql.NullString
	PendingClockIns int
}

// GetSyncState returns the current sync state row.
func GetSyncState(ctx context.Context, q Querier) (*SyncState, error) {
	var s SyncState
	err := q.QueryRowContext(ctx, `SELECT last_attempt_at, last_success_at, last_error, pending_clock_ins
		FROM sync_state WHERE id = 1`).Scan(&s.LastAttemptAt, &s.LastSuccessAt, &s.LastError, &s.PendingClockIns)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// RecordSyncAttempt stores the start time of a cycle.
func RecordSyncAttempt(ctx context.Context, q Querier, at string) error {
	_, err := q.ExecContext(ctx, `UPDATE sync_state SET last_attempt_at = ? WHERE id = 1`, at)
	return err
}

// RecordSyncSuccess stores a successful cycle and clears the last error.
func RecordSyncSuccess(ctx context.Context, q Querier, at string, pending int) error {
	_, err := q.ExecContext(ctx, `UPDATE sync_state SET last_success_at = ?, last_error = NULL,
		pending_clock_ins = ? WHERE id = 1`, at, pending)
	return err
}

// RecordSyncError stores a failed cycle's error.
func RecordSyncError(ctx context.Context, q Querier, msg string, pending int) error {
	_, err := q.ExecContext(ctx, `UPDATE sync_state SET last_error = ?, pending_clock_ins = ? WHERE id = 1`, msg, pending)
	return err
}
