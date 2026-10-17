//go:build windows

package arp

import (
	"os/exec"
	"syscall"
)

// createNoWindow keeps arp.exe and netsh.exe from flashing a console window
// when the server runs without one.
const createNoWindow = 0x08000000

func hideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: createNoWindow}
}
