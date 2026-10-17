//go:build !embedweb

// Package webassets exposes the worker web app compiled into the binary.
// Build with `-tags embedweb` after copying worker_web/build/web into dist/.
package webassets

import "io/fs"

// FS returns the embedded worker web app, or nil when it is not compiled in.
func FS() fs.FS { return nil }
