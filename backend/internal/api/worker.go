package api

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/tobc/church-clockin/internal/db"
)

const (
	cookieName   = "device_token"
	cookieMaxAge = 315360000

	msgUnverifiable  = "Could not verify this device. Make sure you are connected to the church Wi-Fi."
	msgNotRegistered = "This phone is not registered. Please complete setup first."
	msgMACMismatch   = "This phone does not match the device registered for this worker."
	msgInvalidLogin  = "Invalid username or setup code."
	msgMissingFields = "Username and setup code are required."
	msgPhoneTaken    = "This phone is already registered to another worker."
	msgWorkerTaken   = "This worker is already registered on another phone. Ask an admin to reset the device."
	msgInternal      = "Something went wrong. Please try again."
)

type workerJSON struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Department string `json:"department"`
	Username   string `json:"username"`
}

func toWorkerJSON(w *db.Worker) workerJSON {
	return workerJSON{ID: w.ID, Name: w.Name, Department: w.Department, Username: w.Username}
}

type registeredResponse struct {
	Registered     bool       `json:"registered"`
	DeviceToken    string     `json:"device_token"`
	Worker         workerJSON `json:"worker"`
	ClockedInToday bool       `json:"clocked_in_today"`
	ClockedInAt    *string    `json:"clocked_in_at"`
}

// peer describes the calling device.
type peer struct {
	IP  string
	MAC string // "" when the MAC check is skipped for loopback
	// Skip is true for loopback callers when --skip-mac-check is set.
	Skip bool
}

// resolvePeer identifies the caller. It writes a 403 and returns false when
// the device cannot be verified.
func (s *Server) resolvePeer(c *gin.Context) (peer, bool) {
	ip := peerIP(c)
	if ip == nil {
		jsonError(c, http.StatusForbidden, msgUnverifiable)
		return peer{}, false
	}
	p := peer{IP: ip.String()}
	if ip.IsLoopback() {
		if s.SkipMACCheck {
			p.Skip = true
			return p, true
		}
		jsonError(c, http.StatusForbidden, msgUnverifiable)
		return peer{}, false
	}
	if s.Resolver == nil {
		jsonError(c, http.StatusForbidden, msgUnverifiable)
		return peer{}, false
	}
	mac, err := s.Resolver.Lookup(c.Request.Context(), p.IP)
	if err != nil || mac == "" {
		s.logger().Warn("mac lookup failed", "ip", p.IP, "err", err)
		jsonError(c, http.StatusForbidden, msgUnverifiable)
		return peer{}, false
	}
	p.MAC = mac
	return p, true
}

func requestToken(c *gin.Context) string {
	if t := strings.TrimSpace(c.GetHeader("X-Device-Token")); t != "" {
		return t
	}
	if t, err := c.Cookie(cookieName); err == nil {
		return strings.TrimSpace(t)
	}
	return ""
}

func setTokenCookie(c *gin.Context, token string) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     cookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   cookieMaxAge,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func newToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (s *Server) registered(c *gin.Context, w *db.Worker) {
	resp := registeredResponse{
		Registered:  true,
		DeviceToken: w.DeviceToken.String,
		Worker:      toWorkerJSON(w),
	}
	today := s.now().Format(db.LocalDateFormat)
	ci, err := db.ClockInForDate(c.Request.Context(), s.DB, w.ID, today)
	switch {
	case err == nil:
		resp.ClockedInToday = true
		at := ci.ClockedInAt
		resp.ClockedInAt = &at
	case !errors.Is(err, db.ErrNotFound):
		s.logger().Error("clock-in lookup", "err", err)
		jsonError(c, http.StatusInternalServerError, msgInternal)
		return
	}
	setTokenCookie(c, w.DeviceToken.String)
	c.JSON(http.StatusOK, resp)
}

// handleStatus: token+MAC match, else MAC-only match re-issues the token.
func (s *Server) handleStatus(c *gin.Context) {
	p, ok := s.resolvePeer(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	token := requestToken(c)

	w, err := db.WorkerByToken(ctx, s.DB, token)
	if err != nil && !errors.Is(err, db.ErrNotFound) {
		s.logger().Error("worker by token", "err", err)
		jsonError(c, http.StatusInternalServerError, msgInternal)
		return
	}
	if w != nil && (p.Skip || (w.MACAddress.Valid && w.MACAddress.String == p.MAC)) {
		s.registered(c, w)
		return
	}
	if !p.Skip {
		w, err = db.WorkerByMAC(ctx, s.DB, p.MAC)
		if err != nil && !errors.Is(err, db.ErrNotFound) {
			s.logger().Error("worker by mac", "err", err)
			jsonError(c, http.StatusInternalServerError, msgInternal)
			return
		}
		if w != nil && w.DeviceToken.Valid && w.DeviceToken.String != "" {
			s.registered(c, w)
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"registered": false})
}

type registerRequest struct {
	Username  string `json:"username"`
	SetupCode string `json:"setup_code"`
}

func (s *Server) handleRegister(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		jsonError(c, http.StatusBadRequest, msgMissingFields)
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.SetupCode = strings.TrimSpace(req.SetupCode)
	if req.Username == "" || req.SetupCode == "" {
		jsonError(c, http.StatusBadRequest, msgMissingFields)
		return
	}
	p, ok := s.resolvePeer(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()

	w, err := db.WorkerByUsername(ctx, s.DB, req.Username)
	if errors.Is(err, db.ErrNotFound) || (err == nil && !strings.EqualFold(w.SetupCode, req.SetupCode)) {
		jsonError(c, http.StatusUnauthorized, msgInvalidLogin)
		return
	}
	if err != nil {
		s.logger().Error("worker by username", "err", err)
		jsonError(c, http.StatusInternalServerError, msgInternal)
		return
	}

	if p.Skip {
		// Loopback test registration: never binds a MAC and is not pushed to the cloud.
		if w.MACAddress.Valid {
			jsonError(c, http.StatusForbidden, msgWorkerTaken)
			return
		}
		if !w.DeviceToken.Valid || w.DeviceToken.String == "" {
			token, err := newToken()
			if err != nil {
				jsonError(c, http.StatusInternalServerError, msgInternal)
				return
			}
			now := db.Null(db.NowUTC(s.now()))
			if err := db.SetWorkerDevice(ctx, s.DB, w.ID, db.Null(token), w.MACAddress, now, now, false); err != nil {
				s.logger().Error("set device", "err", err)
				jsonError(c, http.StatusInternalServerError, msgInternal)
				return
			}
			w.DeviceToken = db.Null(token)
		}
		s.registered(c, w)
		return
	}

	other, err := db.WorkerByMAC(ctx, s.DB, p.MAC)
	if err != nil && !errors.Is(err, db.ErrNotFound) {
		s.logger().Error("worker by mac", "err", err)
		jsonError(c, http.StatusInternalServerError, msgInternal)
		return
	}
	if other != nil && other.ID != w.ID {
		jsonError(c, http.StatusForbidden, msgPhoneTaken)
		return
	}
	if w.MACAddress.Valid && w.MACAddress.String != p.MAC {
		jsonError(c, http.StatusForbidden, msgWorkerTaken)
		return
	}
	if w.MACAddress.Valid && w.DeviceToken.Valid && w.DeviceToken.String != "" {
		s.registered(c, w)
		return
	}

	token, err := newToken()
	if err != nil {
		jsonError(c, http.StatusInternalServerError, msgInternal)
		return
	}
	now := db.Null(db.NowUTC(s.now()))
	if err := db.SetWorkerDevice(ctx, s.DB, w.ID, db.Null(token), db.Null(p.MAC), now, now, true); err != nil {
		s.logger().Error("set device", "err", err)
		jsonError(c, http.StatusInternalServerError, msgInternal)
		return
	}
	w.DeviceToken = db.Null(token)
	w.MACAddress = db.Null(p.MAC)
	s.logger().Info("device registered", "worker", w.Username, "mac", p.MAC, "ip", p.IP)
	s.registered(c, w)
}

func (s *Server) handleClockIn(c *gin.Context) {
	token := requestToken(c)
	if token == "" {
		jsonError(c, http.StatusUnauthorized, msgNotRegistered)
		return
	}
	p, ok := s.resolvePeer(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	w, err := db.WorkerByToken(ctx, s.DB, token)
	if errors.Is(err, db.ErrNotFound) {
		jsonError(c, http.StatusUnauthorized, msgNotRegistered)
		return
	}
	if err != nil {
		s.logger().Error("worker by token", "err", err)
		jsonError(c, http.StatusInternalServerError, msgInternal)
		return
	}
	if !p.Skip && (!w.MACAddress.Valid || w.MACAddress.String != p.MAC) {
		jsonError(c, http.StatusForbidden, msgMACMismatch)
		return
	}

	now := s.now()
	ci, inserted, err := db.InsertClockIn(ctx, s.DB, &db.ClockIn{
		ID:          uuid.NewString(),
		WorkerID:    w.ID,
		ClockInDate: now.Format(db.LocalDateFormat),
		ClockedInAt: now.Format(db.LocalDateTimeFormat),
		IPAddress:   db.Null(p.IP),
		MACAddress:  db.Null(p.MAC),
		CreatedAt:   db.NowUTC(now),
	})
	if err != nil {
		s.logger().Error("insert clock-in", "err", err)
		jsonError(c, http.StatusInternalServerError, msgInternal)
		return
	}
	if inserted {
		s.logger().Info("clock-in", "worker", w.Username, "at", ci.ClockedInAt)
	}
	c.JSON(http.StatusOK, gin.H{
		"already_clocked_in": !inserted,
		"clock_in_date":      ci.ClockInDate,
		"clocked_in_at":      ci.ClockedInAt,
		"worker":             toWorkerJSON(w),
	})
}
