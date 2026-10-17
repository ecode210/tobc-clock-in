package api

import (
	"io"
	"net/http"
	"path"
	"strings"

	"github.com/gin-gonic/gin"
)

// handleNoRoute serves the worker web SPA from WebFS, falling back to
// index.html. Unknown /api/ paths stay JSON 404s.
func (s *Server) handleNoRoute(c *gin.Context) {
	reqPath := c.Request.URL.Path
	if reqPath == "/api" || strings.HasPrefix(reqPath, "/api/") {
		jsonError(c, http.StatusNotFound, "Not found.")
		return
	}
	if s.WebFS == nil || (c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead) {
		jsonError(c, http.StatusNotFound, "Not found.")
		return
	}

	clean := path.Clean("/" + reqPath)
	if clean != "/" {
		if s.serveFile(c, strings.TrimPrefix(clean, "/"), clean) {
			return
		}
		// Missing assets must 404: Flutter would otherwise try to decode
		// index.html as a font or script.
		if path.Ext(clean) != "" {
			c.Status(http.StatusNotFound)
			return
		}
	}
	if !s.serveFile(c, "index.html", "/index.html") {
		jsonError(c, http.StatusNotFound, "Worker web app is not built.")
	}
}

func (s *Server) serveFile(c *gin.Context, name, urlPath string) bool {
	f, err := s.WebFS.Open(name)
	if err != nil {
		return false
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || info.IsDir() {
		return false
	}
	rs, ok := f.(io.ReadSeeker)
	if !ok {
		return false
	}
	switch urlPath {
	case "/index.html", "/flutter_service_worker.js", "/flutter_bootstrap.js", "/version.json", "/manifest.json":
		c.Header("Cache-Control", "no-cache")
	}
	http.ServeContent(c.Writer, c.Request, info.Name(), info.ModTime(), rs)
	return true
}
