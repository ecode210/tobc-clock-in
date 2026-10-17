package syncer

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/tobc/church-clockin/internal/db"
)

func sp(s string) *string { return &s }

type fakeCloud struct {
	mu             sync.Mutex
	workers        []cloudWorker
	admins         []cloudAdmin
	deviceStatus   map[string]string // worker_id -> status; default "applied"
	rejectClockIns map[string]string // id -> reason
	syncRequested  bool
	failPath       string

	gotDevices   []deviceUpdate
	gotClockIns  [][]clockInPayload
	gotHeartbeat []heartbeatRequest
	authHeaders  []string
	paths        []string
}

func (f *fakeCloud) handler(t *testing.T) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		f.authHeaders = append(f.authHeaders, r.Header.Get("Authorization"))
		f.paths = append(f.paths, r.Method+" "+r.URL.Path)
		if r.URL.Path == f.failPath {
			w.WriteHeader(http.StatusServiceUnavailable)
			io.WriteString(w, `{"error":"database unavailable"}`)
			return
		}
		body, _ := io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		switch r.Method + " " + r.URL.Path {
		case "GET /api/sync/workers":
			json.NewEncoder(w).Encode(map[string]any{"workers": f.workers})
		case "GET /api/sync/admins":
			json.NewEncoder(w).Encode(map[string]any{"admins": f.admins})
		case "POST /api/sync/worker-devices":
			var req struct{ Devices []deviceUpdate }
			json.Unmarshal(body, &req)
			f.gotDevices = append(f.gotDevices, req.Devices...)
			results := []deviceResult{}
			for _, d := range req.Devices {
				st := f.deviceStatus[d.WorkerID]
				if st == "" {
					st = "applied"
				}
				results = append(results, deviceResult{WorkerID: d.WorkerID, Status: st})
			}
			json.NewEncoder(w).Encode(map[string]any{"results": results})
		case "POST /api/sync/clock-ins":
			var req struct {
				ClockIns []clockInPayload `json:"clock_ins"`
			}
			json.Unmarshal(body, &req)
			f.gotClockIns = append(f.gotClockIns, req.ClockIns)
			accepted := []string{}
			rejected := []clockInRejection{}
			for _, c := range req.ClockIns {
				if reason, ok := f.rejectClockIns[c.ID]; ok {
					rejected = append(rejected, clockInRejection{ID: c.ID, Reason: reason})
				} else {
					accepted = append(accepted, c.ID)
				}
			}
			json.NewEncoder(w).Encode(map[string]any{"accepted": accepted, "rejected": rejected})
		case "POST /api/sync/heartbeat":
			var hb heartbeatRequest
			json.Unmarshal(body, &hb)
			f.gotHeartbeat = append(f.gotHeartbeat, hb)
			json.NewEncoder(w).Encode(map[string]any{"sync_requested": f.syncRequested})
		default:
			t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
			w.WriteHeader(404)
		}
	})
}

type env struct {
	db    *db.DB
	cloud *fakeCloud
	s     *Syncer
}

func newEnv(t *testing.T) *env {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "sync.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { database.Close() })
	cloud := &fakeCloud{
		workers: []cloudWorker{}, admins: []cloudAdmin{},
		deviceStatus: map[string]string{}, rejectClockIns: map[string]string{},
	}
	ts := httptest.NewServer(cloud.handler(t))
	t.Cleanup(ts.Close)
	s := New(database, Config{CloudURL: ts.URL, Token: "dev-sync-token", Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	return &env{db: database, cloud: cloud, s: s}
}

func baseWorker(id, user string) cloudWorker {
	return cloudWorker{
		ID: id, Name: "Name " + id, Department: "Choir", Username: user, SetupCode: "ABC234",
		CreatedAt: "2026-10-01T10:00:00Z", UpdatedAt: "2026-10-01T10:00:00Z",
	}
}

func (e *env) worker(t *testing.T, id string) *db.Worker {
	t.Helper()
	w, err := db.WorkerByID(context.Background(), e.db, id)
	if err != nil {
		t.Fatalf("worker %s: %v", id, err)
	}
	return w
}

func (e *env) cycle(t *testing.T) Result {
	t.Helper()
	res := e.s.Cycle(context.Background())
	if !res.OK {
		t.Fatalf("cycle failed: %+v", res)
	}
	return res
}

func TestLoopbackCloudSkipsProbe(t *testing.T) {
	e := newEnv(t)
	if !e.s.skipProbe {
		t.Fatal("expected probe to be skipped for loopback cloud URL")
	}
	for raw, want := range map[string]bool{
		"http://localhost:3000":       true,
		"http://127.0.0.1:3000":       true,
		"http://[::1]:3000":           true,
		"https://admin.example.org":   false,
		"https://192.168.1.10:3000/x": false,
	} {
		if got := isLoopbackURL(raw); got != want {
			t.Errorf("isLoopbackURL(%q) = %v, want %v", raw, got, want)
		}
	}
}

func TestPullWorkersAndAdmins(t *testing.T) {
	e := newEnv(t)
	w := baseWorker("w1", "ada.obi")
	w.DeviceToken, w.MACAddress = sp("tok1"), sp("3A:0F:1C:9D:0E:05")
	w.RegisteredAt, w.DeviceUpdatedAt = sp("2026-10-02T09:00:00.123Z"), sp("2026-10-02T09:00:00.123Z")
	e.cloud.workers = []cloudWorker{w, baseWorker("w2", "ben.eze")}
	e.cloud.admins = []cloudAdmin{{ID: "a1", Username: "admin", PasswordHash: "$2b$10$x", IsSuper: true,
		CreatedAt: "2026-10-01T10:00:00Z", UpdatedAt: "2026-10-01T10:00:00Z"}}

	res := e.cycle(t)
	if res.WorkersPulled != 2 || res.AdminsPulled != 1 {
		t.Fatalf("result = %+v", res)
	}
	got := e.worker(t, "w1")
	if got.MACAddress.String != "3a:0f:1c:9d:0e:05" || got.DeviceToken.String != "tok1" || got.DeviceDirty {
		t.Fatalf("w1 = %+v", got)
	}
	if e.cloud.authHeaders[0] != "Bearer dev-sync-token" {
		t.Fatalf("auth header = %q", e.cloud.authHeaders[0])
	}
	admins, _ := db.ListAdmins(context.Background(), e.db)
	if len(admins) != 1 || !admins[0].IsSuper {
		t.Fatalf("admins = %+v", admins)
	}

	// Identity changes in the cloud overwrite local; admins are replaced.
	e.cloud.workers[0].Name = "Ada Renamed"
	e.cloud.workers[0].SetupCode = "NEW234"
	e.cloud.admins = []cloudAdmin{{ID: "a2", Username: "pastor", PasswordHash: "h", CreatedAt: "2026-10-03T10:00:00Z", UpdatedAt: "2026-10-03T10:00:00Z"}}
	e.cycle(t)
	got = e.worker(t, "w1")
	if got.Name != "Ada Renamed" || got.SetupCode != "NEW234" {
		t.Fatalf("w1 after rename = %+v", got)
	}
	admins, _ = db.ListAdmins(context.Background(), e.db)
	if len(admins) != 1 || admins[0].Username != "pastor" {
		t.Fatalf("admins after replace = %+v", admins)
	}
}

func registerLocally(t *testing.T, e *env, id, token, mac, at string) {
	t.Helper()
	ts := db.Null(at)
	if err := db.SetWorkerDevice(context.Background(), e.db, id, db.Null(token), db.Null(mac), ts, ts, true); err != nil {
		t.Fatal(err)
	}
}

func TestLocalRegistrationPushedAndApplied(t *testing.T) {
	e := newEnv(t)
	e.cloud.workers = []cloudWorker{baseWorker("w1", "ada.obi")}
	e.cycle(t)

	registerLocally(t, e, "w1", "tokL", "aa:bb:cc:dd:ee:01", "2026-10-18T06:10:00Z")
	res := e.cycle(t)
	if res.DevicesPushed != 1 || res.DevicesApplied != 1 {
		t.Fatalf("result = %+v", res)
	}
	d := e.cloud.gotDevices[0]
	if d.WorkerID != "w1" || *d.DeviceToken != "tokL" || *d.MACAddress != "aa:bb:cc:dd:ee:01" || *d.DeviceUpdatedAt != "2026-10-18T06:10:00Z" {
		t.Fatalf("pushed = %+v", d)
	}
	got := e.worker(t, "w1")
	if got.DeviceDirty || got.DeviceToken.String != "tokL" {
		t.Fatalf("w1 = %+v", got)
	}
}

func TestLocalRegistrationNewerThanCloudKeptOnPull(t *testing.T) {
	e := newEnv(t)
	cw := baseWorker("w1", "ada.obi")
	cw.DeviceUpdatedAt = sp("2026-10-10T08:00:00Z") // older reset
	e.cloud.workers = []cloudWorker{cw}
	e.cycle(t)

	registerLocally(t, e, "w1", "tokL", "aa:bb:cc:dd:ee:01", "2026-10-18T06:10:00Z")
	// Fail the device push so the pull's merge decision is observable.
	e.cloud.failPath = "/api/sync/worker-devices"
	res := e.s.Cycle(context.Background())
	if res.OK || res.Error == "" {
		t.Fatalf("expected failure, got %+v", res)
	}
	got := e.worker(t, "w1")
	if !got.DeviceDirty || got.MACAddress.String != "aa:bb:cc:dd:ee:01" {
		t.Fatalf("local registration lost: %+v", got)
	}
	st, _ := db.GetSyncState(context.Background(), e.db)
	if !st.LastError.Valid {
		t.Fatalf("expected last_error recorded")
	}
}

func TestNewerCloudResetBeatsLocalRegistration(t *testing.T) {
	e := newEnv(t)
	e.cloud.workers = []cloudWorker{baseWorker("w1", "ada.obi")}
	e.cycle(t)

	registerLocally(t, e, "w1", "tokL", "aa:bb:cc:dd:ee:01", "2026-10-18T06:10:00Z")
	// Admin reset the device in the cloud after the local registration.
	e.cloud.workers[0].DeviceUpdatedAt = sp("2026-10-18T06:30:00.500Z")
	e.cloud.workers[0].SetupCode = "RST789"
	res := e.cycle(t)
	if res.DevicesPushed != 0 {
		t.Fatalf("reset should win before push: %+v", res)
	}
	got := e.worker(t, "w1")
	if got.DeviceDirty || got.DeviceToken.Valid || got.MACAddress.Valid || got.SetupCode != "RST789" {
		t.Fatalf("w1 after reset = %+v", got)
	}
	if got.DeviceUpdatedAt.String != "2026-10-18T06:30:00.5Z" {
		t.Fatalf("device_updated_at = %q", got.DeviceUpdatedAt.String)
	}
}

func TestRejectedDeviceAdoptsCloud(t *testing.T) {
	e := newEnv(t)
	cw := baseWorker("w1", "ada.obi")
	cw.DeviceToken, cw.MACAddress, cw.DeviceUpdatedAt = sp("tokC"), sp("aa:bb:cc:dd:ee:99"), sp("2026-10-18T06:10:00Z")
	e.cloud.workers = []cloudWorker{cw}
	e.cycle(t)

	// Same timestamp locally (not newer than cloud) so pull keeps local; cloud rejects.
	registerLocally(t, e, "w1", "tokL", "aa:bb:cc:dd:ee:01", "2026-10-18T06:10:00Z")
	e.cloud.deviceStatus["w1"] = "rejected"
	res := e.cycle(t)
	if res.DevicesRejected != 1 {
		t.Fatalf("result = %+v", res)
	}
	got := e.worker(t, "w1")
	if got.DeviceDirty || got.DeviceToken.String != "tokC" || got.MACAddress.String != "aa:bb:cc:dd:ee:99" {
		t.Fatalf("w1 = %+v", got)
	}
}

func TestNotFoundDeviceClearsDirty(t *testing.T) {
	e := newEnv(t)
	e.cloud.workers = []cloudWorker{baseWorker("w1", "ada.obi")}
	e.cycle(t)
	registerLocally(t, e, "w1", "tokL", "aa:bb:cc:dd:ee:01", "2026-10-18T06:10:00Z")
	e.cloud.deviceStatus["w1"] = "not_found"
	res := e.cycle(t)
	if res.DevicesNotFound != 1 || e.worker(t, "w1").DeviceDirty {
		t.Fatalf("result = %+v", res)
	}
}

func addClockIn(t *testing.T, e *env, id, workerID, date string) {
	t.Helper()
	_, ok, err := db.InsertClockIn(context.Background(), e.db, &db.ClockIn{
		ID: id, WorkerID: workerID, ClockInDate: date, ClockedInAt: date + " 07:20:00",
		IPAddress: db.Null("192.168.1.23"), MACAddress: db.Null("aa:bb:cc:dd:ee:01"), CreatedAt: "2026-10-18T06:20:00Z",
	})
	if err != nil || !ok {
		t.Fatalf("insert clock-in %s: %v %v", id, ok, err)
	}
}

func TestClockInPushAndRejections(t *testing.T) {
	e := newEnv(t)
	e.cloud.workers = []cloudWorker{baseWorker("w1", "ada.obi"), baseWorker("w2", "ben.eze"), baseWorker("w3", "cy.udo")}
	e.cycle(t)
	addClockIn(t, e, "c1", "w1", "2026-10-18")
	addClockIn(t, e, "c2", "w2", "2026-10-18")
	addClockIn(t, e, "c3", "w3", "2026-10-18")
	e.cloud.rejectClockIns["c2"] = "worker_not_found"
	e.cloud.rejectClockIns["c3"] = "invalid_date"

	res := e.cycle(t)
	if res.ClockInsPushed != 3 || res.ClockInsAccepted != 1 || res.ClockInsRejected != 2 || res.PendingClockIns != 1 {
		t.Fatalf("result = %+v", res)
	}
	p := e.cloud.gotClockIns[0][0]
	if p.ClockInDate != "2026-10-18" || p.ClockedInAt != "2026-10-18 07:20:00" || *p.IPAddress != "192.168.1.23" {
		t.Fatalf("payload = %+v", p)
	}
	unsynced, _ := db.UnsyncedClockIns(context.Background(), e.db)
	if len(unsynced) != 1 || unsynced[0].ID != "c3" {
		t.Fatalf("unsynced = %+v", unsynced)
	}
	hb := e.cloud.gotHeartbeat[len(e.cloud.gotHeartbeat)-1]
	if hb.PendingClockIns != 1 || hb.Version != "1" || hb.LastSuccessAt == nil {
		t.Fatalf("heartbeat = %+v", hb)
	}
}

func TestClockInFailureKeepsQueue(t *testing.T) {
	e := newEnv(t)
	e.cloud.workers = []cloudWorker{baseWorker("w1", "ada.obi")}
	e.cycle(t)
	addClockIn(t, e, "c1", "w1", "2026-10-18")
	e.cloud.failPath = "/api/sync/clock-ins"
	res := e.s.Cycle(context.Background())
	if res.OK || res.PendingClockIns != 1 {
		t.Fatalf("result = %+v", res)
	}
	e.cloud.failPath = ""
	res = e.cycle(t)
	if res.ClockInsAccepted != 1 || res.PendingClockIns != 0 {
		t.Fatalf("retry = %+v", res)
	}
}

func TestClockInBatching(t *testing.T) {
	e := newEnv(t)
	var workers []cloudWorker
	for i := range 1001 {
		workers = append(workers, baseWorker(fmt.Sprintf("w%04d", i), fmt.Sprintf("user%04d", i)))
	}
	e.cloud.workers = workers
	e.cycle(t)
	tx, _ := e.db.Begin()
	for i := range 1001 {
		_, _, err := db.InsertClockIn(context.Background(), tx, &db.ClockIn{
			ID: fmt.Sprintf("c%04d", i), WorkerID: fmt.Sprintf("w%04d", i), ClockInDate: "2026-10-18",
			ClockedInAt: "2026-10-18 07:00:00", CreatedAt: "2026-10-18T06:00:00Z",
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	tx.Commit()
	res := e.cycle(t)
	if len(e.cloud.gotClockIns) != 3 || len(e.cloud.gotClockIns[0]) != 500 || len(e.cloud.gotClockIns[2]) != 1 {
		t.Fatalf("batches = %d", len(e.cloud.gotClockIns))
	}
	if res.ClockInsAccepted != 1001 || res.PendingClockIns != 0 {
		t.Fatalf("result = %+v", res)
	}
}

func TestDeletedWorkersKeptWhileUnsynced(t *testing.T) {
	e := newEnv(t)
	e.cloud.workers = []cloudWorker{baseWorker("w1", "ada.obi"), baseWorker("w2", "ben.eze"), baseWorker("w3", "cy.udo")}
	e.cycle(t)
	addClockIn(t, e, "c1", "w2", "2026-10-18")
	// Cloud deletes w2 and w3, and its clock-in endpoint is down.
	e.cloud.workers = e.cloud.workers[:1]
	e.cloud.failPath = "/api/sync/clock-ins"
	res := e.s.Cycle(context.Background())
	if res.WorkersDeleted != 1 {
		t.Fatalf("result = %+v", res)
	}
	if _, err := db.WorkerByID(context.Background(), e.db, "w3"); err != db.ErrNotFound {
		t.Fatalf("w3 should be deleted, err = %v", err)
	}
	e.worker(t, "w2") // kept: unsynced clock-in
}

func TestSyncRequestedReported(t *testing.T) {
	e := newEnv(t)
	e.cloud.syncRequested = true
	if res := e.cycle(t); !res.SyncRequested {
		t.Fatalf("sync_requested not reported: %+v", res)
	}
}

func TestOfflineProbe(t *testing.T) {
	e := newEnv(t)
	e.s.skipProbe = false
	e.s.cfg.ProbeURL = "http://127.0.0.1:1"
	res := e.s.Cycle(context.Background())
	if res.OK || res.Online || len(e.cloud.authHeaders) != 0 {
		t.Fatalf("offline result = %+v", res)
	}
	st, _ := db.GetSyncState(context.Background(), e.db)
	if !st.LastAttemptAt.Valid || st.LastSuccessAt.Valid || st.LastError.String != "offline: internet probe failed" {
		t.Fatalf("state = %+v", st)
	}
}

func TestRunLoopHeartbeatTriggersCycle(t *testing.T) {
	e := newEnv(t)
	e.s.cfg.CycleInterval = time.Hour
	e.s.cfg.HeartbeatInterval = 20 * time.Millisecond
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { e.s.Run(ctx, true); close(done) }()

	waitFor := func(cond func() bool) {
		deadline := time.Now().Add(3 * time.Second)
		for time.Now().Before(deadline) {
			e.cloud.mu.Lock()
			ok := cond()
			e.cloud.mu.Unlock()
			if ok {
				return
			}
			time.Sleep(5 * time.Millisecond)
		}
		t.Fatal("timed out")
	}
	waitFor(func() bool { return len(e.cloud.gotHeartbeat) >= 3 })
	e.cloud.mu.Lock()
	e.cloud.syncRequested = true
	before := len(e.cloud.paths)
	e.cloud.mu.Unlock()
	// A light heartbeat returning sync_requested triggers a full cycle (workers pull).
	waitFor(func() bool {
		for _, p := range e.cloud.paths[before:] {
			if p == "GET /api/sync/workers" {
				return true
			}
		}
		return false
	})
	cancel()
	<-done
}
