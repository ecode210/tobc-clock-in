package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tobc/church-clockin/internal/arp"
	"github.com/tobc/church-clockin/internal/db"
)

const (
	phoneA = "192.168.1.23"
	phoneB = "192.168.1.24"
	macA   = "3a:0f:1c:9d:0e:05"
	macB   = "3a:0f:1c:9d:0e:06"
)

type fakeResolver map[string]string

func (f fakeResolver) Lookup(_ context.Context, ip string) (string, error) {
	if mac, ok := f[ip]; ok {
		return mac, nil
	}
	return "", arp.ErrNotFound
}

type harness struct {
	t      *testing.T
	srv    *Server
	router *gin.Engine
	now    time.Time
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	gin.SetMode(gin.TestMode)
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { database.Close() })
	h := &harness{t: t, now: time.Date(2026, 10, 18, 7, 15, 30, 0, time.Local)}
	h.srv = &Server{
		DB:       database,
		Resolver: fakeResolver{phoneA: macA, phoneB: macB},
		Now:      func() time.Time { return h.now },
	}
	h.router = h.srv.Router()
	for _, w := range []struct{ id, name, user, code string }{
		{"w1", "Ada Obi", "ada.obi", "ABC234"},
		{"w2", "Ben Eze", "ben.eze", "XYZ789"},
	} {
		err := db.InsertWorker(context.Background(), database, &db.Worker{
			ID: w.id, Name: w.name, Department: "Ushering", Username: w.user, SetupCode: w.code,
			CreatedAt: "2026-10-01T10:00:00Z", UpdatedAt: "2026-10-01T10:00:00Z",
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	return h
}

type response struct {
	code   int
	body   map[string]any
	header http.Header
}

func (h *harness) do(method, path, remoteIP, token, body string) response {
	h.t.Helper()
	var req *http.Request
	if body != "" {
		req = httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	req.RemoteAddr = remoteIP + ":50000"
	if strings.Contains(remoteIP, ":") {
		req.RemoteAddr = "[" + remoteIP + "]:50000"
	}
	if token != "" {
		req.Header.Set("X-Device-Token", token)
	}
	rec := httptest.NewRecorder()
	h.router.ServeHTTP(rec, req)
	out := response{code: rec.Code, header: rec.Header()}
	if strings.HasPrefix(rec.Header().Get("Content-Type"), "application/json") {
		if err := json.Unmarshal(rec.Body.Bytes(), &out.body); err != nil {
			h.t.Fatalf("decode %s: %v", rec.Body.String(), err)
		}
	}
	return out
}

func (h *harness) register(ip, user, code string) response {
	return h.do(http.MethodPost, "/api/v1/worker/register", ip, "", `{"username":"`+user+`","setup_code":"`+code+`"}`)
}

func expectCode(t *testing.T, r response, code int) {
	t.Helper()
	if r.code != code {
		t.Fatalf("status = %d, want %d (body %v)", r.code, code, r.body)
	}
}

func TestRegisterAndStatus(t *testing.T) {
	h := newHarness(t)

	r := h.do(http.MethodGet, "/api/v1/worker/status", phoneA, "", "")
	expectCode(t, r, 200)
	if r.body["registered"] != false || len(r.body) != 1 {
		t.Fatalf("unregistered status = %v", r.body)
	}

	r = h.register(phoneA, "  ADA.OBI ", "abc234")
	expectCode(t, r, 200)
	token, _ := r.body["device_token"].(string)
	if token == "" || r.body["registered"] != true || r.body["clocked_in_today"] != false || r.body["clocked_in_at"] != nil {
		t.Fatalf("register body = %v", r.body)
	}
	worker := r.body["worker"].(map[string]any)
	if worker["id"] != "w1" || worker["username"] != "ada.obi" || worker["name"] != "Ada Obi" || worker["department"] != "Ushering" {
		t.Fatalf("worker = %v", worker)
	}
	cookie := r.header.Get("Set-Cookie")
	for _, want := range []string{"device_token=" + token, "Path=/", "Max-Age=315360000", "HttpOnly", "SameSite=Lax"} {
		if !strings.Contains(cookie, want) {
			t.Errorf("cookie %q missing %q", cookie, want)
		}
	}
	if strings.Contains(cookie, "Secure") {
		t.Errorf("cookie must not be Secure: %q", cookie)
	}

	w, _ := db.WorkerByID(context.Background(), h.srv.DB, "w1")
	if w.MACAddress.String != macA || !w.DeviceDirty || !w.RegisteredAt.Valid || !w.DeviceUpdatedAt.Valid {
		t.Fatalf("stored worker = %+v", w)
	}

	r = h.do(http.MethodGet, "/api/v1/worker/status", phoneA, token, "")
	expectCode(t, r, 200)
	if r.body["registered"] != true || r.body["device_token"] != token {
		t.Fatalf("status = %v", r.body)
	}
}

func TestTokenReissueByMAC(t *testing.T) {
	h := newHarness(t)
	token := h.register(phoneA, "ada.obi", "ABC234").body["device_token"].(string)

	// Lost token (cleared storage): MAC-only match re-issues the same token.
	r := h.do(http.MethodGet, "/api/v1/worker/status", phoneA, "", "")
	expectCode(t, r, 200)
	if r.body["device_token"] != token || !strings.Contains(r.header.Get("Set-Cookie"), token) {
		t.Fatalf("reissue = %v", r.body)
	}

	// Wrong token from the bound phone still resolves via MAC.
	r = h.do(http.MethodGet, "/api/v1/worker/status", phoneA, "bogus", "")
	if r.body["device_token"] != token {
		t.Fatalf("reissue with bad token = %v", r.body)
	}

	// Re-registering from the same phone returns the same token.
	r = h.register(phoneA, "ada.obi", "abc234")
	expectCode(t, r, 200)
	if r.body["device_token"] != token {
		t.Fatalf("re-register token changed: %v", r.body)
	}

	// The token copied to another phone is not accepted.
	r = h.do(http.MethodGet, "/api/v1/worker/status", phoneB, token, "")
	if r.body["registered"] != false {
		t.Fatalf("token on other phone = %v", r.body)
	}
}

func TestMACCollision(t *testing.T) {
	h := newHarness(t)
	expectCode(t, h.register(phoneA, "ada.obi", "ABC234"), 200)

	// Same phone, different worker.
	r := h.register(phoneA, "ben.eze", "XYZ789")
	expectCode(t, r, 403)
	if !strings.Contains(r.body["error"].(string), "another worker") {
		t.Fatalf("error = %v", r.body)
	}
	// Same worker, different phone.
	r = h.register(phoneB, "ada.obi", "ABC234")
	expectCode(t, r, 403)
	if !strings.Contains(r.body["error"].(string), "another phone") {
		t.Fatalf("error = %v", r.body)
	}
}

func TestRegisterErrors(t *testing.T) {
	h := newHarness(t)
	expectCode(t, h.register(phoneA, "", "ABC234"), 400)
	expectCode(t, h.do(http.MethodPost, "/api/v1/worker/register", phoneA, "", `nope`), 400)
	expectCode(t, h.register(phoneA, "nobody", "ABC234"), 401)
	expectCode(t, h.register(phoneA, "ada.obi", "WRONG1"), 401)

	r := h.register("192.168.1.99", "ada.obi", "ABC234")
	expectCode(t, r, 403)
	if r.body["error"] != msgUnverifiable {
		t.Fatalf("error = %v", r.body)
	}
	// Loopback without --skip-mac-check cannot be verified either.
	expectCode(t, h.register("127.0.0.1", "ada.obi", "ABC234"), 403)
}

func TestDailyUniqueClockIn(t *testing.T) {
	h := newHarness(t)
	token := h.register(phoneA, "ada.obi", "ABC234").body["device_token"].(string)

	r := h.do(http.MethodPost, "/api/v1/worker/clock-in", phoneA, token, "")
	expectCode(t, r, 200)
	if r.body["already_clocked_in"] != false || r.body["clock_in_date"] != "2026-10-18" || r.body["clocked_in_at"] != "2026-10-18 07:15:30" {
		t.Fatalf("clock-in = %v", r.body)
	}
	if r.body["worker"].(map[string]any)["id"] != "w1" {
		t.Fatalf("worker = %v", r.body["worker"])
	}

	h.now = h.now.Add(20 * time.Minute)
	r = h.do(http.MethodPost, "/api/v1/worker/clock-in", phoneA, token, "")
	expectCode(t, r, 200)
	if r.body["already_clocked_in"] != true || r.body["clocked_in_at"] != "2026-10-18 07:15:30" {
		t.Fatalf("second clock-in = %v", r.body)
	}

	r = h.do(http.MethodGet, "/api/v1/worker/status", phoneA, token, "")
	if r.body["clocked_in_today"] != true || r.body["clocked_in_at"] != "2026-10-18 07:15:30" {
		t.Fatalf("status = %v", r.body)
	}

	n, _ := db.PendingClockInCount(context.Background(), h.srv.DB)
	if n != 1 {
		t.Fatalf("pending = %d, want 1", n)
	}

	h.now = h.now.Add(7 * 24 * time.Hour)
	r = h.do(http.MethodPost, "/api/v1/worker/clock-in", phoneA, token, "")
	if r.body["already_clocked_in"] != false || r.body["clock_in_date"] != "2026-10-25" {
		t.Fatalf("next week = %v", r.body)
	}
}

func TestClockInAuth(t *testing.T) {
	h := newHarness(t)
	token := h.register(phoneA, "ada.obi", "ABC234").body["device_token"].(string)

	expectCode(t, h.do(http.MethodPost, "/api/v1/worker/clock-in", phoneA, "", ""), 401)
	expectCode(t, h.do(http.MethodPost, "/api/v1/worker/clock-in", phoneA, "bogus", ""), 401)
	expectCode(t, h.do(http.MethodPost, "/api/v1/worker/clock-in", phoneB, token, ""), 403)
	expectCode(t, h.do(http.MethodPost, "/api/v1/worker/clock-in", "192.168.1.99", token, ""), 403)

	// Cookie works as well as the header.
	req := httptest.NewRequest(http.MethodPost, "/api/v1/worker/clock-in", nil)
	req.RemoteAddr = phoneA + ":1234"
	req.AddCookie(&http.Cookie{Name: "device_token", Value: token})
	rec := httptest.NewRecorder()
	h.router.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("cookie clock-in = %d %s", rec.Code, rec.Body.String())
	}
}

func TestSkipMACCheckLoopback(t *testing.T) {
	h := newHarness(t)
	h.srv.SkipMACCheck = true

	a := h.register("127.0.0.1", "ada.obi", "ABC234")
	expectCode(t, a, 200)
	b := h.register("::1", "ben.eze", "XYZ789")
	expectCode(t, b, 200)

	w, _ := db.WorkerByID(context.Background(), h.srv.DB, "w1")
	if w.MACAddress.Valid || w.DeviceDirty {
		t.Fatalf("skip-mode registration bound a MAC or marked dirty: %+v", w)
	}
	r := h.do(http.MethodPost, "/api/v1/worker/clock-in", "127.0.0.1", b.body["device_token"].(string), "")
	expectCode(t, r, 200)
	if r.body["worker"].(map[string]any)["id"] != "w2" {
		t.Fatalf("clock-in = %v", r.body)
	}
	// Skip mode never applies to LAN peers.
	expectCode(t, h.register("192.168.1.99", "ada.obi", "ABC234"), 403)
}

func TestCORSLoopbackOnly(t *testing.T) {
	h := newHarness(t)
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/worker/register", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	req.Header.Set("Access-Control-Request-Method", "POST")
	rec := httptest.NewRecorder()
	h.router.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent || rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" ||
		rec.Header().Get("Access-Control-Allow-Credentials") != "true" ||
		!strings.Contains(rec.Header().Get("Access-Control-Allow-Headers"), "X-Device-Token") {
		t.Fatalf("preflight = %d %v", rec.Code, rec.Header())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/v1/worker/status", nil)
	req.RemoteAddr = phoneA + ":1"
	req.Header.Set("Origin", "http://evil.example.com")
	rec = httptest.NewRecorder()
	h.router.ServeHTTP(rec, req)
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("non-loopback origin got CORS headers")
	}
}

func TestSyncEndpointsLoopbackOnly(t *testing.T) {
	h := newHarness(t)
	expectCode(t, h.do(http.MethodPost, "/api/v1/sync", phoneA, "", ""), 403)
	expectCode(t, h.do(http.MethodGet, "/api/v1/sync/status", phoneA, "", ""), 403)
	r := h.do(http.MethodGet, "/api/v1/sync/status", "127.0.0.1", "", "")
	expectCode(t, r, 200)
	if r.body["enabled"] != false {
		t.Fatalf("status = %v", r.body)
	}
	r = h.do(http.MethodPost, "/api/v1/sync", "127.0.0.1", "", "")
	expectCode(t, r, 200)
	if r.body["ok"] != false {
		t.Fatalf("sync = %v", r.body)
	}
}

func TestLocalEndpoints(t *testing.T) {
	h := newHarness(t)
	expectCode(t, h.do(http.MethodGet, "/api/v1/local/summary", phoneA, "", ""), 403)
	expectCode(t, h.do(http.MethodPost, "/api/v1/local/shutdown", phoneA, "", ""), 403)

	expectCode(t, h.register(phoneA, "ada.obi", "ABC234"), 200)
	r := h.do(http.MethodGet, "/api/v1/local/summary", "127.0.0.1", "", "")
	expectCode(t, r, 200)
	if r.body["workers"] != float64(2) || r.body["devices_locked"] != float64(1) || r.body["date"] != "2026-10-18" {
		t.Fatalf("summary = %v", r.body)
	}

	expectCode(t, h.do(http.MethodPost, "/api/v1/local/shutdown", "127.0.0.1", "", ""), 501)
	called := make(chan struct{})
	h.srv.Shutdown = func() { close(called) }
	expectCode(t, h.do(http.MethodPost, "/api/v1/local/shutdown", "127.0.0.1", "", ""), 200)
	select {
	case <-called:
	case <-time.After(time.Second):
		t.Fatal("shutdown not called")
	}
}

func TestStaticSPAFallback(t *testing.T) {
	h := newHarness(t)
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>spa</html>"), 0o644)
	os.WriteFile(filepath.Join(dir, "main.dart.js"), []byte("console.log(1)"), 0o644)
	os.MkdirAll(filepath.Join(dir, "assets"), 0o755)
	h.srv.WebFS = os.DirFS(dir)

	get := func(path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.RemoteAddr = phoneA + ":1"
		rec := httptest.NewRecorder()
		h.router.ServeHTTP(rec, req)
		return rec
	}
	if rec := get("/"); rec.Code != 200 || rec.Body.String() != "<html>spa</html>" {
		t.Fatalf("/ = %d %q", rec.Code, rec.Body.String())
	}
	if rec := get("/main.dart.js"); rec.Code != 200 || rec.Body.String() != "console.log(1)" {
		t.Fatalf("/main.dart.js = %d %q", rec.Code, rec.Body.String())
	}
	for _, p := range []string{"/setup", "/assets", "/../../etc/passwd"} {
		if rec := get(p); rec.Code != 200 || rec.Body.String() != "<html>spa</html>" {
			t.Fatalf("%s = %d %q", p, rec.Code, rec.Body.String())
		}
	}
	if rec := get("/assets/fallback-fonts/roboto/x.woff2"); rec.Code != 404 {
		t.Fatalf("missing asset = %d %q", rec.Code, rec.Body.String())
	}
	rec := get("/api/v1/nope")
	if rec.Code != 404 || !strings.Contains(rec.Body.String(), `"error"`) {
		t.Fatalf("/api/v1/nope = %d %q", rec.Code, rec.Body.String())
	}
}
