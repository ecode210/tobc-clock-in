// Package api wires the Gin HTTP server: worker endpoints, loopback sync
// controls, and the worker web SPA.
package api

import (
	"context"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tobc/church-clockin/internal/arp"
	"github.com/tobc/church-clockin/internal/db"
)

// SyncRunner is the subset of the sync engine used by the HTTP layer.
type SyncRunner interface {
	RunCycle(ctx context.Context) any
	Status(ctx context.Context) (any, error)
}

// Server holds the dependencies for the HTTP handlers.
type Server struct {
	DB           *db.DB
	Resolver     arp.Resolver
	SkipMACCheck bool
	Syncer       SyncRunner
	// WebFS holds the built worker web app served at /. Nil serves nothing.
	WebFS fs.FS
	// Shutdown, when set, is called by the loopback shutdown endpoint so the
	// desktop app can stop the server gracefully.
	Shutdown func()
	Now      func() time.Time
	Logger   *slog.Logger
}

func (s *Server) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

func (s *Server) logger() *slog.Logger {
	if s.Logger != nil {
		return s.Logger
	}
	return slog.Default()
}

// Router builds the Gin engine.
func (s *Server) Router() *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	_ = r.SetTrustedProxies(nil)
	r.ForwardedByClientIP = false

	worker := r.Group("/api/v1/worker", loopbackCORS())
	worker.GET("/status", s.handleStatus)
	worker.POST("/register", s.handleRegister)
	worker.POST("/clock-in", s.handleClockIn)
	worker.OPTIONS("/*path", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	syncGroup := r.Group("/api/v1/sync", loopbackOnly())
	syncGroup.POST("", s.handleSyncNow)
	syncGroup.GET("/status", s.handleSyncStatus)

	local := r.Group("/api/v1/local", loopbackOnly())
	local.GET("/summary", s.handleLocalSummary)
	local.POST("/shutdown", s.handleLocalShutdown)

	r.NoRoute(s.handleNoRoute)
	return r
}

func jsonError(c *gin.Context, status int, msg string) {
	c.AbortWithStatusJSON(status, gin.H{"error": msg})
}

// peerIP returns the TCP peer address, unwrapping IPv4-mapped IPv6.
func peerIP(c *gin.Context) net.IP {
	host, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil {
		host = c.Request.RemoteAddr
	}
	if i := strings.IndexByte(host, '%'); i >= 0 {
		host = host[:i]
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return nil
	}
	if v4 := ip.To4(); v4 != nil {
		return v4
	}
	return ip
}

func loopbackOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := peerIP(c)
		if ip == nil || !ip.IsLoopback() {
			jsonError(c, http.StatusForbidden, "This endpoint is only available on the church laptop.")
			return
		}
		c.Next()
	}
}

func isLoopbackHost(host string) bool {
	host = strings.Trim(host, "[]")
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// loopbackCORS allows credentialed cross-origin calls from loopback origins
// (Flutter dev server on another port). Other origins get no CORS headers.
func loopbackCORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" {
			if host := originHost(origin); host != "" && isLoopbackHost(host) {
				h := c.Writer.Header()
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Access-Control-Allow-Credentials", "true")
				h.Set("Access-Control-Allow-Headers", "Content-Type, X-Device-Token")
				h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
				h.Set("Access-Control-Max-Age", "600")
				h.Add("Vary", "Origin")
			}
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func originHost(origin string) string {
	rest, ok := strings.CutPrefix(origin, "http://")
	if !ok {
		rest, ok = strings.CutPrefix(origin, "https://")
		if !ok {
			return ""
		}
	}
	if i := strings.IndexByte(rest, '/'); i >= 0 {
		rest = rest[:i]
	}
	if host, _, err := net.SplitHostPort(rest); err == nil {
		return host
	}
	return rest
}

func (s *Server) handleSyncNow(c *gin.Context) {
	if s.Syncer == nil {
		c.JSON(http.StatusOK, gin.H{"ok": false, "error": "sync is disabled: no cloud URL configured"})
		return
	}
	c.JSON(http.StatusOK, s.Syncer.RunCycle(c.Request.Context()))
}

func (s *Server) handleLocalSummary(c *gin.Context) {
	ctx := c.Request.Context()
	today := s.now().Format(db.LocalDateFormat)
	var workers, registered, clockedIn int
	err := s.DB.QueryRowContext(ctx, `SELECT
		(SELECT count(*) FROM workers),
		(SELECT count(*) FROM workers WHERE device_token IS NOT NULL),
		(SELECT count(*) FROM clock_ins WHERE clock_in_date = ?)`, today).Scan(&workers, &registered, &clockedIn)
	if err != nil {
		jsonError(c, http.StatusInternalServerError, "Could not read the local database.")
		return
	}
	pending, _ := db.PendingClockInCount(ctx, s.DB)
	c.JSON(http.StatusOK, gin.H{
		"date":              today,
		"workers":           workers,
		"devices_locked":    registered,
		"clocked_in_today":  clockedIn,
		"pending_clock_ins": pending,
	})
}

func (s *Server) handleLocalShutdown(c *gin.Context) {
	if s.Shutdown == nil {
		jsonError(c, http.StatusNotImplemented, "Shutdown is not available.")
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
	go s.Shutdown()
}

func (s *Server) handleSyncStatus(c *gin.Context) {
	if s.Syncer == nil {
		st, err := db.GetSyncState(c.Request.Context(), s.DB)
		if err != nil {
			jsonError(c, http.StatusInternalServerError, "Could not read sync status.")
			return
		}
		pending, _ := db.PendingClockInCount(c.Request.Context(), s.DB)
		c.JSON(http.StatusOK, gin.H{
			"enabled":           false,
			"last_attempt_at":   db.Ptr(st.LastAttemptAt),
			"last_success_at":   db.Ptr(st.LastSuccessAt),
			"last_error":        db.Ptr(st.LastError),
			"pending_clock_ins": pending,
		})
		return
	}
	st, err := s.Syncer.Status(c.Request.Context())
	if err != nil {
		jsonError(c, http.StatusInternalServerError, "Could not read sync status.")
		return
	}
	c.JSON(http.StatusOK, st)
}
