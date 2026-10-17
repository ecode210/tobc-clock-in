// Package syncer pushes local clock-ins and device bindings to the cloud
// admin portal and pulls workers and admins from it. Sync is always
// initiated by the laptop.
package syncer

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/tobc/church-clockin/internal/db"
)

const (
	clockInBatchSize  = 500
	defaultProbeURL   = "https://1.1.1.1"
	protocolVersion   = "1"
	defaultCycle      = 60 * time.Second
	defaultHeartbeat  = 15 * time.Second
	probeTimeout      = 2 * time.Second
	defaultHTTPTimout = 20 * time.Second
)

// Config configures the sync engine.
type Config struct {
	CloudURL          string
	Token             string
	HTTPClient        *http.Client
	ProbeURL          string
	CycleInterval     time.Duration
	HeartbeatInterval time.Duration
	Logger            *slog.Logger
	Now               func() time.Time
}

// Syncer runs sync cycles against the cloud.
type Syncer struct {
	db          *db.DB
	cfg         Config
	baseURL     string
	client      *http.Client
	probeClient *http.Client
	skipProbe   bool
	log         *slog.Logger

	mu          sync.Mutex
	lastProbeOK atomic.Bool
}

// Result is the outcome of one sync cycle.
type Result struct {
	OK               bool   `json:"ok"`
	Online           bool   `json:"online"`
	StartedAt        string `json:"started_at"`
	FinishedAt       string `json:"finished_at"`
	WorkersPulled    int    `json:"workers_pulled"`
	WorkersDeleted   int    `json:"workers_deleted"`
	AdminsPulled     int    `json:"admins_pulled"`
	DevicesPushed    int    `json:"devices_pushed"`
	DevicesApplied   int    `json:"devices_applied"`
	DevicesRejected  int    `json:"devices_rejected"`
	DevicesNotFound  int    `json:"devices_not_found"`
	ClockInsPushed   int    `json:"clock_ins_pushed"`
	ClockInsAccepted int    `json:"clock_ins_accepted"`
	ClockInsRejected int    `json:"clock_ins_rejected"`
	PendingClockIns  int    `json:"pending_clock_ins"`
	SyncRequested    bool   `json:"sync_requested"`
	Error            string `json:"error,omitempty"`
}

// New creates a Syncer. cfg.CloudURL must be non-empty.
func New(database *db.DB, cfg Config) *Syncer {
	if cfg.ProbeURL == "" {
		cfg.ProbeURL = defaultProbeURL
	}
	if cfg.CycleInterval <= 0 {
		cfg.CycleInterval = defaultCycle
	}
	if cfg.HeartbeatInterval <= 0 {
		cfg.HeartbeatInterval = defaultHeartbeat
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	log := cfg.Logger
	if log == nil {
		log = slog.Default()
	}
	client := cfg.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: defaultHTTPTimout}
	}
	return &Syncer{
		db:          database,
		cfg:         cfg,
		baseURL:     strings.TrimRight(cfg.CloudURL, "/"),
		client:      client,
		probeClient: &http.Client{Timeout: probeTimeout},
		skipProbe:   isLoopbackURL(cfg.CloudURL),
		log:         log.With("component", "sync"),
	}
}

func isLoopbackURL(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	host := u.Hostname()
	if strings.EqualFold(host, "localhost") || strings.HasSuffix(strings.ToLower(host), ".localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func (s *Syncer) nowUTC() string { return db.NowUTC(s.cfg.Now()) }

// RunCycle implements api.SyncRunner.
func (s *Syncer) RunCycle(ctx context.Context) any { return s.Cycle(ctx) }

// Status implements api.SyncRunner.
func (s *Syncer) Status(ctx context.Context) (any, error) {
	st, err := db.GetSyncState(ctx, s.db)
	if err != nil {
		return nil, err
	}
	pending, err := db.PendingClockInCount(ctx, s.db)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"enabled":           true,
		"cloud_url":         s.baseURL,
		"online":            s.lastProbeOK.Load(),
		"last_attempt_at":   db.Ptr(st.LastAttemptAt),
		"last_success_at":   db.Ptr(st.LastSuccessAt),
		"last_error":        db.Ptr(st.LastError),
		"pending_clock_ins": pending,
	}, nil
}

func (s *Syncer) probe(ctx context.Context) bool {
	if s.skipProbe {
		return true
	}
	ctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, s.cfg.ProbeURL, nil)
	if err != nil {
		return false
	}
	resp, err := s.probeClient.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return true
}

// Cycle runs one full sync cycle: probe, pull workers and admins, push dirty
// devices, push clock-ins, heartbeat. Errors are recorded, never returned.
func (s *Syncer) Cycle(ctx context.Context) (res Result) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.cycleLocked(ctx)
}

func (s *Syncer) cycleLocked(ctx context.Context) (res Result) {
	res.StartedAt = s.nowUTC()
	defer func() {
		if r := recover(); r != nil {
			res.OK = false
			res.Error = fmt.Sprintf("internal error: %v", r)
			s.log.Error("sync cycle panicked", "panic", r)
		}
		res.FinishedAt = s.nowUTC()
		pending, err := db.PendingClockInCount(context.Background(), s.db)
		if err == nil {
			res.PendingClockIns = pending
		}
		if res.OK {
			err = db.RecordSyncSuccess(context.Background(), s.db, res.FinishedAt, res.PendingClockIns)
		} else {
			err = db.RecordSyncError(context.Background(), s.db, res.Error, res.PendingClockIns)
		}
		if err != nil {
			s.log.Error("record sync state", "err", err)
		}
	}()

	if err := db.RecordSyncAttempt(ctx, s.db, res.StartedAt); err != nil {
		res.Error = "record attempt: " + err.Error()
		return res
	}
	prevState, err := db.GetSyncState(ctx, s.db)
	if err != nil {
		res.Error = "read sync state: " + err.Error()
		return res
	}

	if !s.probe(ctx) {
		s.lastProbeOK.Store(false)
		res.Error = "offline: internet probe failed"
		s.log.Info("offline, skipping sync")
		return res
	}
	s.lastProbeOK.Store(true)
	res.Online = true

	if err := s.runSteps(ctx, &res, prevState); err != nil {
		res.Error = err.Error()
		s.log.Warn("sync cycle failed", "err", err)
		return res
	}
	res.OK = true
	s.log.Info("sync cycle complete",
		"workers", res.WorkersPulled, "admins", res.AdminsPulled,
		"devices_pushed", res.DevicesPushed, "clock_ins_accepted", res.ClockInsAccepted,
		"sync_requested", res.SyncRequested)
	return res
}

func (s *Syncer) runSteps(ctx context.Context, res *Result, prev *db.SyncState) error {
	workers, err := s.fetchWorkers(ctx)
	if err != nil {
		return err
	}
	admins, err := s.fetchAdmins(ctx)
	if err != nil {
		return err
	}
	pulled, deleted, err := s.applyWorkers(ctx, workers)
	if err != nil {
		return fmt.Errorf("apply workers: %w", err)
	}
	res.WorkersPulled, res.WorkersDeleted = pulled, deleted
	if err := s.applyAdmins(ctx, admins); err != nil {
		return fmt.Errorf("apply admins: %w", err)
	}
	res.AdminsPulled = len(admins)

	cloudByID := make(map[string]cloudWorker, len(workers))
	for _, w := range workers {
		cloudByID[w.ID] = w
	}
	if err := s.pushDevices(ctx, res, cloudByID); err != nil {
		return err
	}
	if err := s.pushClockIns(ctx, res); err != nil {
		return err
	}

	pending, err := db.PendingClockInCount(ctx, s.db)
	if err != nil {
		return err
	}
	requested, err := s.postHeartbeat(ctx, heartbeatRequest{
		PendingClockIns: pending,
		LastSuccessAt:   db.Ptr(prev.LastSuccessAt),
		Version:         protocolVersion,
	})
	if err != nil {
		return err
	}
	res.SyncRequested = requested
	return nil
}

type deviceFields struct {
	token, mac, registeredAt, updatedAt sql.NullString
}

func cloudDevice(cw cloudWorker) deviceFields {
	mac := db.NullPtr(cw.MACAddress)
	if mac.Valid {
		mac.String = strings.ToLower(strings.TrimSpace(mac.String))
	}
	return deviceFields{
		token:        db.NullPtr(cw.DeviceToken),
		mac:          mac,
		registeredAt: normalizeNull(db.NullPtr(cw.RegisteredAt)),
		updatedAt:    normalizeNull(db.NullPtr(cw.DeviceUpdatedAt)),
	}
}

func normalizeNull(ns sql.NullString) sql.NullString {
	if ns.Valid {
		ns.String = db.NormalizeTimestamp(ns.String)
	}
	return ns
}

// applyWorkers merges the cloud worker list into SQLite. Identity fields
// always come from the cloud; device fields only when the cloud's
// device_updated_at is newer. Workers missing from the cloud are deleted
// unless they still have unsynced clock-ins.
func (s *Syncer) applyWorkers(ctx context.Context, workers []cloudWorker) (pulled, deleted int, err error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback()

	seen := make(map[string]bool, len(workers))
	for _, cw := range workers {
		if cw.ID == "" {
			continue
		}
		seen[cw.ID] = true
		dev := cloudDevice(cw)
		incoming := &db.Worker{
			ID:         cw.ID,
			Name:       cw.Name,
			Department: cw.Department,
			Username:   strings.TrimSpace(cw.Username),
			SetupCode:  cw.SetupCode,
			CreatedAt:  db.NormalizeTimestamp(cw.CreatedAt),
			UpdatedAt:  db.NormalizeTimestamp(cw.UpdatedAt),
		}
		local, err := db.WorkerByID(ctx, tx, cw.ID)
		switch {
		case errors.Is(err, db.ErrNotFound):
			incoming.DeviceToken, incoming.MACAddress = dev.token, dev.mac
			incoming.RegisteredAt, incoming.DeviceUpdatedAt = dev.registeredAt, dev.updatedAt
			if err := db.InsertWorker(ctx, tx, incoming); err != nil {
				return 0, 0, err
			}
		case err != nil:
			return 0, 0, err
		default:
			if err := db.UpdateWorkerIdentity(ctx, tx, incoming); err != nil {
				return 0, 0, err
			}
			adopt := db.IsNewer(dev.updatedAt, local.DeviceUpdatedAt) ||
				(!local.DeviceDirty && !local.DeviceUpdatedAt.Valid)
			if adopt {
				if local.DeviceDirty {
					s.log.Info("cloud device change wins over local registration", "worker", cw.Username)
				}
				if err := db.SetWorkerDevice(ctx, tx, cw.ID, dev.token, dev.mac, dev.registeredAt, dev.updatedAt, false); err != nil {
					return 0, 0, err
				}
			}
		}
		pulled++
	}

	locals, err := db.ListWorkers(ctx, tx)
	if err != nil {
		return 0, 0, err
	}
	for _, lw := range locals {
		if seen[lw.ID] {
			continue
		}
		ok, err := db.DeleteWorkerIfNoPending(ctx, tx, lw.ID)
		if err != nil {
			return 0, 0, err
		}
		if ok {
			deleted++
		} else {
			s.log.Warn("worker removed in cloud but has unsynced clock-ins; keeping", "worker", lw.Username)
		}
	}
	return pulled, deleted, tx.Commit()
}

func (s *Syncer) applyAdmins(ctx context.Context, admins []cloudAdmin) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	rows := make([]db.Admin, 0, len(admins))
	for _, a := range admins {
		rows = append(rows, db.Admin{
			ID:           a.ID,
			Username:     a.Username,
			PasswordHash: a.PasswordHash,
			IsSuper:      a.IsSuper,
			CreatedAt:    db.NormalizeTimestamp(a.CreatedAt),
			UpdatedAt:    db.NormalizeTimestamp(a.UpdatedAt),
		})
	}
	if err := db.ReplaceAdmins(ctx, tx, rows); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Syncer) pushDevices(ctx context.Context, res *Result, cloudByID map[string]cloudWorker) error {
	dirty, err := db.DirtyWorkers(ctx, s.db)
	if err != nil {
		return err
	}
	if len(dirty) == 0 {
		return nil
	}
	sent := make(map[string]sql.NullString, len(dirty))
	devices := make([]deviceUpdate, 0, len(dirty))
	for _, w := range dirty {
		sent[w.ID] = w.DeviceUpdatedAt
		devices = append(devices, deviceUpdate{
			WorkerID:        w.ID,
			DeviceToken:     db.Ptr(w.DeviceToken),
			MACAddress:      db.Ptr(w.MACAddress),
			RegisteredAt:    db.Ptr(w.RegisteredAt),
			DeviceUpdatedAt: db.Ptr(w.DeviceUpdatedAt),
		})
	}
	res.DevicesPushed = len(devices)
	results, err := s.postDevices(ctx, devices)
	if err != nil {
		return err
	}
	for _, r := range results {
		sentAt, ok := sent[r.WorkerID]
		if !ok {
			continue
		}
		switch r.Status {
		case "applied", "not_found":
			if r.Status == "applied" {
				res.DevicesApplied++
			} else {
				res.DevicesNotFound++
			}
			if err := db.ClearDeviceDirty(ctx, s.db, r.WorkerID, sentAt); err != nil {
				return err
			}
		case "rejected":
			res.DevicesRejected++
			if err := s.adoptCloudDevice(ctx, r.WorkerID, sentAt, cloudByID); err != nil {
				return err
			}
		default:
			s.log.Warn("unknown device push status", "worker_id", r.WorkerID, "status", r.Status)
		}
	}
	return nil
}

// adoptCloudDevice replaces a rejected local binding with the cloud's, unless
// the binding changed locally after it was pushed.
func (s *Syncer) adoptCloudDevice(ctx context.Context, workerID string, sentAt sql.NullString, cloudByID map[string]cloudWorker) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	local, err := db.WorkerByID(ctx, tx, workerID)
	if errors.Is(err, db.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if local.DeviceUpdatedAt != sentAt {
		return nil
	}
	if cw, ok := cloudByID[workerID]; ok {
		dev := cloudDevice(cw)
		err = db.SetWorkerDevice(ctx, tx, workerID, dev.token, dev.mac, dev.registeredAt, dev.updatedAt, false)
	} else {
		err = db.ClearDeviceDirty(ctx, tx, workerID, sentAt)
	}
	if err != nil {
		return err
	}
	s.log.Info("cloud rejected local device binding; adopted cloud state", "worker_id", workerID)
	return tx.Commit()
}

func (s *Syncer) pushClockIns(ctx context.Context, res *Result) error {
	pending, err := db.UnsyncedClockIns(ctx, s.db)
	if err != nil {
		return err
	}
	for start := 0; start < len(pending); start += clockInBatchSize {
		end := min(start+clockInBatchSize, len(pending))
		batch := make([]clockInPayload, 0, end-start)
		for _, c := range pending[start:end] {
			batch = append(batch, clockInPayload{
				ID:          c.ID,
				WorkerID:    c.WorkerID,
				ClockInDate: c.ClockInDate,
				ClockedInAt: c.ClockedInAt,
				IPAddress:   db.Ptr(c.IPAddress),
				MACAddress:  db.Ptr(c.MACAddress),
			})
		}
		res.ClockInsPushed += len(batch)
		accepted, rejected, err := s.postClockIns(ctx, batch)
		if err != nil {
			return err
		}
		done := append([]string{}, accepted...)
		for _, r := range rejected {
			if r.Reason == "worker_not_found" {
				s.log.Warn("cloud has no worker for clock-in; dropping from queue", "clock_in_id", r.ID)
				done = append(done, r.ID)
			} else {
				s.log.Warn("cloud rejected clock-in", "clock_in_id", r.ID, "reason", r.Reason)
			}
		}
		if err := db.MarkClockInsSynced(ctx, s.db, done); err != nil {
			return err
		}
		res.ClockInsAccepted += len(accepted)
		res.ClockInsRejected += len(rejected)
	}
	return nil
}

// heartbeat sends a lightweight heartbeat between full cycles.
func (s *Syncer) heartbeat(ctx context.Context) (bool, error) {
	if !s.mu.TryLock() {
		return false, nil
	}
	defer s.mu.Unlock()
	st, err := db.GetSyncState(ctx, s.db)
	if err != nil {
		return false, err
	}
	pending, err := db.PendingClockInCount(ctx, s.db)
	if err != nil {
		return false, err
	}
	return s.postHeartbeat(ctx, heartbeatRequest{
		PendingClockIns: pending,
		LastSuccessAt:   db.Ptr(st.LastSuccessAt),
		Version:         protocolVersion,
	})
}

// Run loops until ctx is cancelled: a full cycle every CycleInterval and,
// while the last probe succeeded, a heartbeat every HeartbeatInterval.
// If runNow is true a cycle runs immediately.
func (s *Syncer) Run(ctx context.Context, runNow bool) {
	cycleTicker := time.NewTicker(s.cfg.CycleInterval)
	defer cycleTicker.Stop()
	hbTicker := time.NewTicker(s.cfg.HeartbeatInterval)
	defer hbTicker.Stop()

	full := func() {
		res := s.Cycle(ctx)
		if res.SyncRequested && ctx.Err() == nil {
			s.log.Info("cloud requested sync; running another cycle")
			s.Cycle(ctx)
		}
		cycleTicker.Reset(s.cfg.CycleInterval)
		hbTicker.Reset(s.cfg.HeartbeatInterval)
	}
	if runNow {
		full()
	}
	for {
		select {
		case <-ctx.Done():
			return
		case <-cycleTicker.C:
			full()
		case <-hbTicker.C:
			if !s.lastProbeOK.Load() {
				continue
			}
			requested, err := s.heartbeat(ctx)
			if err != nil {
				s.log.Debug("heartbeat failed", "err", err)
				continue
			}
			if requested {
				s.log.Info("cloud requested sync")
				full()
			}
		}
	}
}
