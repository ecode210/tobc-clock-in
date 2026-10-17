package db

import (
	"context"
	"database/sql"
	"errors"
	"strings"
)

// Worker is a row in the workers table.
type Worker struct {
	ID              string
	Name            string
	Department      string
	Username        string
	SetupCode       string
	DeviceToken     sql.NullString
	MACAddress      sql.NullString
	RegisteredAt    sql.NullString
	CreatedAt       string
	UpdatedAt       string
	DeviceUpdatedAt sql.NullString
	DeviceDirty     bool
}

const workerColumns = `id, name, department, username, setup_code, device_token, mac_address,
	registered_at, created_at, updated_at, device_updated_at, device_dirty`

func scanWorker(row interface{ Scan(...any) error }) (*Worker, error) {
	var w Worker
	var dirty int
	err := row.Scan(&w.ID, &w.Name, &w.Department, &w.Username, &w.SetupCode, &w.DeviceToken,
		&w.MACAddress, &w.RegisteredAt, &w.CreatedAt, &w.UpdatedAt, &w.DeviceUpdatedAt, &dirty)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	w.DeviceDirty = dirty != 0
	return &w, nil
}

func queryWorkers(ctx context.Context, q Querier, where string, args ...any) ([]*Worker, error) {
	rows, err := q.QueryContext(ctx, `SELECT `+workerColumns+` FROM workers `+where, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Worker
	for rows.Next() {
		w, err := scanWorker(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, rows.Err()
}

// WorkerByID returns the worker with the given id.
func WorkerByID(ctx context.Context, q Querier, id string) (*Worker, error) {
	return scanWorker(q.QueryRowContext(ctx, `SELECT `+workerColumns+` FROM workers WHERE id = ?`, id))
}

// WorkerByUsername looks a worker up by trimmed, case-insensitive username.
func WorkerByUsername(ctx context.Context, q Querier, username string) (*Worker, error) {
	return scanWorker(q.QueryRowContext(ctx,
		`SELECT `+workerColumns+` FROM workers WHERE lower(username) = lower(?) ORDER BY created_at LIMIT 1`,
		strings.TrimSpace(username)))
}

// WorkerByToken returns the worker holding the device token.
func WorkerByToken(ctx context.Context, q Querier, token string) (*Worker, error) {
	if token == "" {
		return nil, ErrNotFound
	}
	return scanWorker(q.QueryRowContext(ctx,
		`SELECT `+workerColumns+` FROM workers WHERE device_token = ? LIMIT 1`, token))
}

// WorkerByMAC returns the worker bound to the MAC address.
func WorkerByMAC(ctx context.Context, q Querier, mac string) (*Worker, error) {
	if mac == "" {
		return nil, ErrNotFound
	}
	return scanWorker(q.QueryRowContext(ctx,
		`SELECT `+workerColumns+` FROM workers WHERE mac_address = ?
		 ORDER BY device_updated_at DESC LIMIT 1`, mac))
}

// ListWorkers returns all workers.
func ListWorkers(ctx context.Context, q Querier) ([]*Worker, error) {
	return queryWorkers(ctx, q, `ORDER BY name`)
}

// DirtyWorkers returns workers whose device binding has not been pushed to the cloud.
func DirtyWorkers(ctx context.Context, q Querier) ([]*Worker, error) {
	return queryWorkers(ctx, q, `WHERE device_dirty = 1 ORDER BY device_updated_at`)
}

// InsertWorker inserts a full worker row.
func InsertWorker(ctx context.Context, q Querier, w *Worker) error {
	_, err := q.ExecContext(ctx, `INSERT INTO workers (`+workerColumns+`)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		w.ID, w.Name, w.Department, w.Username, w.SetupCode, w.DeviceToken, w.MACAddress,
		w.RegisteredAt, w.CreatedAt, w.UpdatedAt, w.DeviceUpdatedAt, boolInt(w.DeviceDirty))
	return err
}

// UpdateWorkerIdentity overwrites the cloud-owned identity fields.
func UpdateWorkerIdentity(ctx context.Context, q Querier, w *Worker) error {
	_, err := q.ExecContext(ctx, `UPDATE workers SET name = ?, department = ?, username = ?,
		setup_code = ?, created_at = ?, updated_at = ? WHERE id = ?`,
		w.Name, w.Department, w.Username, w.SetupCode, w.CreatedAt, w.UpdatedAt, w.ID)
	return err
}

// SetWorkerDevice overwrites the device binding fields and dirty flag.
func SetWorkerDevice(ctx context.Context, q Querier, id string, token, mac, registeredAt, deviceUpdatedAt sql.NullString, dirty bool) error {
	_, err := q.ExecContext(ctx, `UPDATE workers SET device_token = ?, mac_address = ?,
		registered_at = ?, device_updated_at = ?, device_dirty = ? WHERE id = ?`,
		token, mac, registeredAt, deviceUpdatedAt, boolInt(dirty), id)
	return err
}

// ClearDeviceDirty clears the dirty flag if the binding was not changed since
// deviceUpdatedAt was read.
func ClearDeviceDirty(ctx context.Context, q Querier, id string, deviceUpdatedAt sql.NullString) error {
	_, err := q.ExecContext(ctx, `UPDATE workers SET device_dirty = 0
		WHERE id = ? AND device_updated_at IS ?`, id, deviceUpdatedAt)
	return err
}

// DeleteWorkerIfNoPending deletes a worker unless it still has unsynced clock-ins.
// It reports whether the row was deleted.
func DeleteWorkerIfNoPending(ctx context.Context, q Querier, id string) (bool, error) {
	res, err := q.ExecContext(ctx, `DELETE FROM workers WHERE id = ? AND NOT EXISTS (
		SELECT 1 FROM clock_ins WHERE worker_id = workers.id AND synced_to_cloud = 0)`, id)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n > 0, err
}

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
