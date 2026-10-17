// Command server runs the church laptop clock-in server.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tobc/church-clockin/internal/api"
	"github.com/tobc/church-clockin/internal/arp"
	"github.com/tobc/church-clockin/internal/db"
	syncer "github.com/tobc/church-clockin/internal/sync"
	"github.com/tobc/church-clockin/internal/webassets"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	port := flag.Int("port", 8080, "HTTP port to listen on (all interfaces)")
	dbPath := flag.String("db-path", "attendance.db", "path to the SQLite database file")
	webDir := flag.String("web-dir", "", "directory of the built worker web app (served at /); defaults to the copy compiled into the binary, if any")
	cloudURL := flag.String("cloud-url", os.Getenv("CLOUD_URL"), "cloud admin base URL; empty disables sync (env CLOUD_URL)")
	syncToken := flag.String("sync-token", os.Getenv("SYNC_TOKEN"), "bearer token for the cloud sync API (env SYNC_TOKEN)")
	skipMAC := flag.Bool("skip-mac-check", false, "allow loopback callers without a MAC check (testing only)")
	syncNow := flag.Bool("sync-now", false, "run one sync cycle at startup")
	exitOnStdinClose := flag.Bool("exit-on-stdin-close", false, "shut down when stdin closes, so the server stops if the desktop app that launched it exits")
	flag.Parse()

	log := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)

	if os.Getenv(gin.EnvGinMode) == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	if dir := filepath.Dir(*dbPath); dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("create db directory: %w", err)
		}
	}
	database, err := db.Open(*dbPath)
	if err != nil {
		return err
	}
	defer database.Close()

	var webFS fs.FS
	webSource := "embedded"
	if *webDir != "" {
		if info, err := os.Stat(filepath.Join(*webDir, "index.html")); err != nil || info.IsDir() {
			log.Warn("web dir has no index.html; worker web app will not load", "web_dir", *webDir)
		}
		webFS = os.DirFS(*webDir)
		webSource = *webDir
	} else if webFS = webassets.FS(); webFS == nil {
		webSource = "none"
		log.Warn("no worker web app: pass --web-dir or build with -tags embedweb")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if *exitOnStdinClose {
		go func() {
			_, _ = io.Copy(io.Discard, os.Stdin)
			log.Info("stdin closed; shutting down")
			stop()
		}()
	}

	srv := &api.Server{
		DB:           database,
		Resolver:     arp.SystemResolver{},
		SkipMACCheck: *skipMAC,
		WebFS:        webFS,
		Shutdown:     stop,
		Logger:       log,
	}

	if *cloudURL != "" {
		if *syncToken == "" {
			log.Warn("cloud URL set but sync token is empty; cloud will reject sync requests")
		}
		s := syncer.New(database, syncer.Config{CloudURL: *cloudURL, Token: *syncToken, Logger: log})
		srv.Syncer = s
		go s.Run(ctx, *syncNow)
		log.Info("cloud sync enabled", "cloud_url", *cloudURL)
	} else {
		log.Info("cloud sync disabled (no --cloud-url / CLOUD_URL)")
	}
	if *skipMAC {
		log.Warn("--skip-mac-check is on: loopback requests bypass device verification")
	}

	httpServer := &http.Server{
		Addr:              fmt.Sprintf(":%d", *port),
		Handler:           srv.Router(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	errCh := make(chan error, 1)
	go func() {
		log.Info("listening", "addr", httpServer.Addr, "db", *dbPath, "web", webSource)
		errCh <- httpServer.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		log.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = httpServer.Shutdown(shutdownCtx)
	}
	return nil
}
