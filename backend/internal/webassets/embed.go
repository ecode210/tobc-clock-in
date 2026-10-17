//go:build embedweb

// Package webassets exposes the worker web app compiled into the binary.
// Build with `-tags embedweb` after copying worker_web/build/web into dist/.
package webassets

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var files embed.FS

// FS returns the embedded worker web app, or nil when it is not compiled in.
func FS() fs.FS {
	sub, err := fs.Sub(files, "dist")
	if err != nil {
		return nil
	}
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		return nil
	}
	return sub
}
