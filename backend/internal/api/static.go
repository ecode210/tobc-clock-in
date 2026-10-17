package api

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// handleNoRoute serves the worker web SPA from WebDir, falling back to
// index.html. Unknown /api/ paths stay JSON 404s.
func (s *Server) handleNoRoute(c *gin.Context) {
	reqPath := c.Request.URL.Path
	if reqPath == "/api" || strings.HasPrefix(reqPath, "/api/") {
		jsonError(c, http.StatusNotFound, "Not found.")
		return
	}
	if s.WebDir == "" || (c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead) {
		jsonError(c, http.StatusNotFound, "Not found.")
		return
	}

	clean := path.Clean("/" + reqPath)
	if clean != "/" {
		full := filepath.Join(s.WebDir, filepath.FromSlash(clean))
		if s.serveFile(c, full, clean) {
			return
		}
		// Missing assets must 404: Flutter would otherwise try to decode
		// index.html as a font or script.
		if path.Ext(clean) != "" {
			c.Status(http.StatusNotFound)
			return
		}
	}
	if !s.serveFile(c, filepath.Join(s.WebDir, "index.html"), "/index.html") {
		jsonError(c, http.StatusNotFound, "Worker web app is not built.")
	}
}

func (s *Server) serveFile(c *gin.Context, full, urlPath string) bool {
	f, err := os.Open(full)
	if err != nil {
		return false
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || info.IsDir() {
		return false
	}
	switch urlPath {
	case "/index.html", "/flutter_service_worker.js", "/flutter_bootstrap.js", "/version.json", "/manifest.json":
		c.Header("Cache-Control", "no-cache")
	}
	http.ServeContent(c.Writer, c.Request, info.Name(), info.ModTime(), f)
	return true
}
