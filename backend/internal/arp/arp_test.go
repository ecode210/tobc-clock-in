package arp

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func fixture(t *testing.T, name string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func TestNormalizeMAC(t *testing.T) {
	cases := map[string]string{
		"0:1a:2B:3:4:5":     "00:1a:2b:03:04:05",
		"00-1A-2B-03-04-05": "00:1a:2b:03:04:05",
		"00:00:00:00:00:00": "",
		"ff-ff-ff-ff-ff-ff": "",
		"(incomplete)":      "",
		"00:1a:2b:03:04":    "",
		"00:1a:2b:03:04:zz": "",
	}
	for in, want := range cases {
		if got := NormalizeMAC(in); got != want {
			t.Errorf("NormalizeMAC(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestParsers(t *testing.T) {
	cases := []struct {
		name   string
		file   string
		parse  func(string) map[string]string
		expect map[string]string
	}{
		{"bsd arp", "darwin_arp.txt", ParseBSDARP, map[string]string{
			"192.168.1.1":  "a4:2b:b0:01:02:03",
			"192.168.1.23": "3a:0f:1c:9d:0e:05",
			"224.0.0.251":  "01:00:5e:00:00:fb",
		}},
		{"windows arp", "windows_arp.txt", ParseWindowsARP, map[string]string{
			"192.168.1.1":  "a4:2b:b0:01:02:03",
			"192.168.1.23": "3a:0f:1c:9d:0e:05",
			"224.0.0.22":   "01:00:5e:00:00:16",
		}},
		{"linux proc arp", "linux_proc_arp.txt", ParseLinuxProcARP, map[string]string{
			"192.168.1.1":  "a4:2b:b0:01:02:03",
			"192.168.1.23": "3a:0f:1c:9d:0e:05",
		}},
		{"linux ip neigh", "linux_ip_neigh.txt", ParseLinuxIPNeigh, map[string]string{
			"192.168.1.1":             "a4:2b:b0:01:02:03",
			"fe80::1":                 "a4:2b:b0:01:02:03",
			"fe80::38f:1cff:fe9d:e05": "3a:0f:1c:9d:0e:05",
		}},
		{"macos ndp", "darwin_ndp.txt", ParseNDP, map[string]string{
			"fe80::1":                 "a4:2b:b0:01:02:03",
			"fe80::38f:1cff:fe9d:e05": "3a:0f:1c:9d:0e:05",
			"2001:db8::23":            "3a:0f:1c:9d:0e:05",
		}},
		{"windows netsh", "windows_netsh.txt", ParseWindowsNetsh, map[string]string{
			"fe80::1":                 "a4:2b:b0:01:02:03",
			"fe80::38f:1cff:fe9d:e05": "3a:0f:1c:9d:0e:05",
			"ff02::1":                 "33:33:00:00:00:01",
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := tc.parse(fixture(t, tc.file))
			if !reflect.DeepEqual(got, tc.expect) {
				t.Errorf("got %v\nwant %v", got, tc.expect)
			}
		})
	}
}
