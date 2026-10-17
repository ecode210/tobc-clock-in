// Package arp resolves a LAN peer's IP address to its MAC address using the
// operating system's ARP (IPv4) and neighbor (IPv6) tables.
package arp

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// ErrNotFound is returned when no complete neighbor entry exists for the IP.
var ErrNotFound = errors.New("mac address not found")

// Resolver maps an IP address to a lowercase colon-separated MAC address.
type Resolver interface {
	Lookup(ctx context.Context, ip string) (string, error)
}

// SystemResolver queries the host's neighbor tables.
type SystemResolver struct{}

// Lookup implements Resolver.
func (SystemResolver) Lookup(ctx context.Context, ip string) (string, error) {
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return "", fmt.Errorf("invalid ip %q", ip)
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var table map[string]string
	var err error
	if v4 := parsed.To4(); v4 != nil {
		table, err = ipv4Table(ctx)
	} else {
		table, err = ipv6Table(ctx)
	}
	if err != nil {
		return "", err
	}
	if mac, ok := table[parsed.String()]; ok {
		return mac, nil
	}
	return "", ErrNotFound
}

func ipv4Table(ctx context.Context) (map[string]string, error) {
	switch runtime.GOOS {
	case "linux":
		data, err := os.ReadFile("/proc/net/arp")
		if err == nil {
			if t := ParseLinuxProcARP(string(data)); len(t) > 0 {
				return t, nil
			}
		}
		out, err := run(ctx, "ip", "-4", "neigh", "show")
		if err != nil {
			return nil, err
		}
		return ParseLinuxIPNeigh(out), nil
	case "windows":
		out, err := run(ctx, "arp", "-a")
		if err != nil {
			return nil, err
		}
		return ParseWindowsARP(out), nil
	default:
		out, err := run(ctx, "arp", "-an")
		if err != nil {
			return nil, err
		}
		return ParseBSDARP(out), nil
	}
}

func ipv6Table(ctx context.Context) (map[string]string, error) {
	switch runtime.GOOS {
	case "linux":
		out, err := run(ctx, "ip", "-6", "neigh", "show")
		if err != nil {
			return nil, err
		}
		return ParseLinuxIPNeigh(out), nil
	case "windows":
		out, err := run(ctx, "netsh", "interface", "ipv6", "show", "neighbors")
		if err != nil {
			return nil, err
		}
		return ParseWindowsNetsh(out), nil
	default:
		out, err := run(ctx, "ndp", "-an")
		if err != nil {
			return nil, err
		}
		return ParseNDP(out), nil
	}
}

func run(ctx context.Context, name string, args ...string) (string, error) {
	out, err := exec.CommandContext(ctx, name, args...).Output()
	if err != nil {
		return "", fmt.Errorf("%s: %w", name, err)
	}
	return string(out), nil
}

// NormalizeMAC converts "0:1a:2B:3:4:5" or "00-1A-2B-03-04-05" to
// "00:1a:2b:03:04:05". It returns "" for invalid, all-zero, or broadcast MACs.
func NormalizeMAC(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	s = strings.ReplaceAll(s, "-", ":")
	parts := strings.Split(s, ":")
	if len(parts) != 6 {
		return ""
	}
	for i, p := range parts {
		if len(p) == 0 || len(p) > 2 {
			return ""
		}
		for _, r := range p {
			if !strings.ContainsRune("0123456789abcdef", r) {
				return ""
			}
		}
		if len(p) == 1 {
			parts[i] = "0" + p
		}
	}
	mac := strings.Join(parts, ":")
	if mac == "00:00:00:00:00:00" || mac == "ff:ff:ff:ff:ff:ff" {
		return ""
	}
	return mac
}

func normalizeIP(s string) string {
	if i := strings.IndexByte(s, '%'); i >= 0 {
		s = s[:i]
	}
	ip := net.ParseIP(strings.TrimSpace(s))
	if ip == nil {
		return ""
	}
	return ip.String()
}

func add(table map[string]string, ip, mac string) {
	ip = normalizeIP(ip)
	mac = NormalizeMAC(mac)
	if ip == "" || mac == "" {
		return
	}
	if _, exists := table[ip]; !exists {
		table[ip] = mac
	}
}

func lines(s string) []string {
	var out []string
	sc := bufio.NewScanner(strings.NewReader(s))
	for sc.Scan() {
		out = append(out, sc.Text())
	}
	return out
}

// ParseBSDARP parses macOS/BSD `arp -an` output:
//
//	? (192.168.1.5) at 0:1a:2b:3c:4d:5e on en0 ifscope [ethernet]
//	? (192.168.1.9) at (incomplete) on en0 ifscope [ethernet]
func ParseBSDARP(out string) map[string]string {
	table := map[string]string{}
	for _, line := range lines(out) {
		open := strings.IndexByte(line, '(')
		closeIdx := strings.IndexByte(line, ')')
		if open < 0 || closeIdx < open {
			continue
		}
		ip := line[open+1 : closeIdx]
		rest := strings.Fields(line[closeIdx+1:])
		if len(rest) < 2 || rest[0] != "at" {
			continue
		}
		add(table, ip, rest[1])
	}
	return table
}

// ParseWindowsARP parses Windows `arp -a` output:
//
//	192.168.1.5           00-1a-2b-3c-4d-5e     dynamic
func ParseWindowsARP(out string) map[string]string {
	table := map[string]string{}
	for _, line := range lines(out) {
		f := strings.Fields(line)
		if len(f) < 2 || net.ParseIP(f[0]) == nil {
			continue
		}
		add(table, f[0], f[1])
	}
	return table
}

// ParseLinuxProcARP parses /proc/net/arp. Rows with flags 0x0 are incomplete.
func ParseLinuxProcARP(out string) map[string]string {
	table := map[string]string{}
	for _, line := range lines(out) {
		f := strings.Fields(line)
		if len(f) < 4 || net.ParseIP(f[0]) == nil {
			continue
		}
		if f[2] == "0x0" {
			continue
		}
		add(table, f[0], f[3])
	}
	return table
}

// ParseLinuxIPNeigh parses `ip neigh` output:
//
//	192.168.1.5 dev wlan0 lladdr 00:1a:2b:3c:4d:5e REACHABLE
//	fe80::1 dev wlan0 lladdr 00:1a:2b:3c:4d:5f router STALE
//	192.168.1.9 dev wlan0 INCOMPLETE
func ParseLinuxIPNeigh(out string) map[string]string {
	table := map[string]string{}
	for _, line := range lines(out) {
		f := strings.Fields(line)
		if len(f) < 1 {
			continue
		}
		state := f[len(f)-1]
		if state == "INCOMPLETE" || state == "FAILED" {
			continue
		}
		for i := 1; i+1 < len(f); i++ {
			if f[i] == "lladdr" {
				add(table, f[0], f[i+1])
				break
			}
		}
	}
	return table
}

// ParseNDP parses macOS `ndp -an` output:
//
//	Neighbor                        Linklayer Address  Netif Expire    St Flgs Prbs
//	fe80::1%en0                     a:b:c:d:e:f          en0 23h59m58s S  R
//	fe80::9%en0                     (incomplete)         en0 expired   N
func ParseNDP(out string) map[string]string {
	table := map[string]string{}
	for _, line := range lines(out) {
		f := strings.Fields(line)
		if len(f) < 2 || f[0] == "Neighbor" {
			continue
		}
		add(table, f[0], f[1])
	}
	return table
}

// ParseWindowsNetsh parses `netsh interface ipv6 show neighbors` output:
//
//	fe80::1                                       00-1a-2b-3c-4d-5e  Reachable (Router)
//	fe80::9                                                          Unreachable
func ParseWindowsNetsh(out string) map[string]string {
	table := map[string]string{}
	for _, line := range lines(out) {
		f := strings.Fields(line)
		if len(f) < 3 || net.ParseIP(normalizeIP(f[0])) == nil {
			continue
		}
		state := strings.ToLower(f[2])
		if state == "unreachable" || state == "incomplete" {
			continue
		}
		add(table, f[0], f[1])
	}
	return table
}
