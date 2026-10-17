package syncer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type cloudWorker struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	Department      string  `json:"department"`
	Username        string  `json:"username"`
	SetupCode       string  `json:"setup_code"`
	DeviceToken     *string `json:"device_token"`
	MACAddress      *string `json:"mac_address"`
	RegisteredAt    *string `json:"registered_at"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
	DeviceUpdatedAt *string `json:"device_updated_at"`
}

type cloudAdmin struct {
	ID           string `json:"id"`
	Username     string `json:"username"`
	PasswordHash string `json:"password_hash"`
	IsSuper      bool   `json:"is_super"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

type deviceUpdate struct {
	WorkerID        string  `json:"worker_id"`
	DeviceToken     *string `json:"device_token"`
	MACAddress      *string `json:"mac_address"`
	RegisteredAt    *string `json:"registered_at"`
	DeviceUpdatedAt *string `json:"device_updated_at"`
}

type deviceResult struct {
	WorkerID string `json:"worker_id"`
	Status   string `json:"status"`
}

type clockInPayload struct {
	ID          string  `json:"id"`
	WorkerID    string  `json:"worker_id"`
	ClockInDate string  `json:"clock_in_date"`
	ClockedInAt string  `json:"clocked_in_at"`
	IPAddress   *string `json:"ip_address"`
	MACAddress  *string `json:"mac_address"`
}

type clockInRejection struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
}

type heartbeatRequest struct {
	PendingClockIns int     `json:"pending_clock_ins"`
	LastSuccessAt   *string `json:"last_success_at"`
	Version         string  `json:"version"`
}

// HTTPError is a non-2xx response from the cloud.
type HTTPError struct {
	Method, Path string
	Status       int
	Message      string
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("%s %s: HTTP %d: %s", e.Method, e.Path, e.Status, e.Message)
}

func (s *Syncer) call(ctx context.Context, method, path string, body, out any) error {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, s.baseURL+path, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.cfg.Token)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("%s %s: %w", method, path, err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 64<<20))
	if err != nil {
		return fmt.Errorf("%s %s: read body: %w", method, path, err)
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		msg := strings.TrimSpace(string(data))
		var e struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(data, &e) == nil && e.Error != "" {
			msg = e.Error
		}
		if len(msg) > 300 {
			msg = msg[:300]
		}
		return &HTTPError{Method: method, Path: path, Status: resp.StatusCode, Message: msg}
	}
	if out != nil {
		if err := json.Unmarshal(data, out); err != nil {
			return fmt.Errorf("%s %s: decode response: %w", method, path, err)
		}
	}
	return nil
}

func (s *Syncer) fetchWorkers(ctx context.Context) ([]cloudWorker, error) {
	var resp struct {
		Workers *[]cloudWorker `json:"workers"`
	}
	if err := s.call(ctx, http.MethodGet, "/api/sync/workers", nil, &resp); err != nil {
		return nil, err
	}
	if resp.Workers == nil {
		return nil, fmt.Errorf("GET /api/sync/workers: response has no workers list")
	}
	return *resp.Workers, nil
}

func (s *Syncer) fetchAdmins(ctx context.Context) ([]cloudAdmin, error) {
	var resp struct {
		Admins *[]cloudAdmin `json:"admins"`
	}
	if err := s.call(ctx, http.MethodGet, "/api/sync/admins", nil, &resp); err != nil {
		return nil, err
	}
	if resp.Admins == nil {
		return nil, fmt.Errorf("GET /api/sync/admins: response has no admins list")
	}
	return *resp.Admins, nil
}

func (s *Syncer) postDevices(ctx context.Context, devices []deviceUpdate) ([]deviceResult, error) {
	var resp struct {
		Results []deviceResult `json:"results"`
	}
	err := s.call(ctx, http.MethodPost, "/api/sync/worker-devices", map[string]any{"devices": devices}, &resp)
	return resp.Results, err
}

func (s *Syncer) postClockIns(ctx context.Context, batch []clockInPayload) ([]string, []clockInRejection, error) {
	var resp struct {
		Accepted []string           `json:"accepted"`
		Rejected []clockInRejection `json:"rejected"`
	}
	err := s.call(ctx, http.MethodPost, "/api/sync/clock-ins", map[string]any{"clock_ins": batch}, &resp)
	return resp.Accepted, resp.Rejected, err
}

func (s *Syncer) postHeartbeat(ctx context.Context, hb heartbeatRequest) (bool, error) {
	var resp struct {
		SyncRequested bool `json:"sync_requested"`
	}
	err := s.call(ctx, http.MethodPost, "/api/sync/heartbeat", hb, &resp)
	return resp.SyncRequested, err
}
