# TOBC Clock-In

Offline-first worker clock-in system for The Olivebrook Church.

Workers clock in from their phones over the church Wi-Fi, even when the building has no internet. A laptop at church records every clock-in locally and syncs with a cloud admin portal whenever it is online.

## How it fits together

```
 Worker phones ──Wi-Fi──▶ Church laptop ──internet (when available)──▶ Cloud admin
 (worker_web)          (desktop_app + backend)     every 60s          (cloud_admin, Postgres)
```

| Part | Stack | What it does |
|---|---|---|
| [`backend/`](backend) | Go, Gin, SQLite | Runs on the church laptop. Serves the worker app, records clock-ins, locks each worker to one phone, and syncs with the cloud. |
| [`worker_web/`](worker_web) | Flutter web | The page workers open on their phones. Fully offline: no CDN, fonts bundled. |
| [`cloud_admin/`](cloud_admin) | Next.js, Postgres | Admin portal for managing workers, viewing attendance, and exporting CSVs. |
| [`desktop_app/`](desktop_app) | Flutter desktop (macOS, Windows) | The app the church tech team uses. Bundles the server, turns it on and off, shows the worker address as a QR code, and lives in the menu bar or system tray. |

### Clock-in flow

1. An admin adds a worker in the cloud admin. The worker gets a username and a 6-character setup code (print a sheet from **Workers > Print setup codes**).
2. The laptop pulls the worker list on its next sync.
3. On the church Wi-Fi, the worker opens the laptop's address on their phone and enters the username and setup code once. That locks the worker to that phone, using a long-lived cookie and the phone's MAC address.
4. From then on, opening the page clocks them in with one tap. One clock-in per worker per day.
5. The laptop pushes clock-ins and device bindings to the cloud. Admins see them under **Attendance**, marked on time or late against the on-time cutoff set on the dashboard.

### Sync

The laptop always starts the sync, so it works behind any church router. Every 60 seconds it:

- pushes new clock-ins and changed device bindings,
- pulls workers and admin accounts,
- sends a heartbeat, so the dashboard can show whether the laptop is online.

Between full syncs, the laptop also sends a heartbeat every 15 seconds. All sync requests use a shared bearer token (`SYNC_TOKEN`). Admins can press **Sync now** in the portal, and the laptop runs a full sync on its next heartbeat.

## Local development

### Requirements

- Go 1.26+
- Flutter (stable)
- Node.js 20+
- Docker (for Postgres)

### 1. Start Postgres

```bash
docker compose up -d db   # Postgres 16 on localhost:5433, user/password/db: clockin
```

### 2. Run the cloud admin

```bash
cd cloud_admin
cp .env.example .env.local   # then set AUTH_SECRET to a long random value
npm install
npm run dev                  # http://localhost:3000
```

The schema is applied automatically on first use, and a super admin is seeded with username `admin` and password `admin`. The dashboard warns you until that password is changed.

Other scripts: `npm run lint`, `npm run typecheck`, `npm run build`.

### 3. Build and run the laptop server

```bash
./scripts/build_all.sh   # builds the worker app into backend/bin/church-clockin

./backend/bin/church-clockin \
  --db-path backend/attendance.db \
  --cloud-url http://localhost:3000 \
  --sync-token dev-sync-token \
  --sync-now
```

Then open `http://<laptop-ip>:8080` on a phone on the same Wi-Fi. Find the IP with `ipconfig getifaddr en0` on macOS.

| Flag | Default | Purpose |
|---|---|---|
| `--port` | `8080` | HTTP port, on all interfaces |
| `--db-path` | `attendance.db` | SQLite database file |
| `--web-dir` | none | Serve the worker app from this folder instead of the copy built into the binary |
| `--cloud-url` | `$CLOUD_URL` | Cloud admin base URL. Empty disables sync. |
| `--sync-token` | `$SYNC_TOKEN` | Must match the cloud admin's `SYNC_TOKEN` |
| `--sync-now` | `false` | Run one sync immediately at startup |
| `--skip-mac-check` | `false` | Allow requests from the laptop itself without a MAC check. Testing only. |
| `--exit-on-stdin-close` | `false` | Stop when stdin closes. The desktop app uses it so the server never outlives the app. |

Opening `http://localhost:8080` on the laptop itself is rejected unless you pass `--skip-mac-check`, because device locking needs the caller's MAC address.

### 4. Run the desktop app

```bash
./scripts/build_all.sh       # the app finds backend/bin/church-clockin during development
cd desktop_app && flutter run -d macos   # or -d windows
```

On first launch it asks for the cloud admin address and sync token. Settings and the SQLite database live in the app's data folder (shown on the Settings screen).

### Tests

```bash
(cd backend && go test ./...)
(cd worker_web && flutter test)
(cd desktop_app && flutter test)
(cd cloud_admin && npm run lint && npm run typecheck)
```

## Configuration

Cloud admin environment variables (see [`cloud_admin/.env.example`](cloud_admin/.env.example)):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Signs admin session cookies. Generate with `openssl rand -hex 32`. |
| `SYNC_TOKEN` | Shared secret for the laptop's sync requests |
| `APP_TIMEZONE` | IANA zone for "today", e.g. `Africa/Lagos`. Defaults to the server's zone. |

## Deployment

### Cloud admin

The `Dockerfile` at the repo root builds a standalone production image of the cloud admin that listens on port 3000. Build it from the repo root (`docker build -t tobc-cloud-admin .`), then run it next to Postgres, for example on Dokploy with the default Dockerfile settings. In production:

- Serve it over **HTTPS**. Session cookies are marked secure, so sign-in will not stick over plain HTTP.
- Use fresh random values for `AUTH_SECRET` and `SYNC_TOKEN`. Never reuse the example values.
- Set `APP_TIMEZONE` to the church's zone, since servers usually run on UTC.
- Sign in as `admin` / `admin` and change the password straight away.
- Set up regular Postgres backups.

### Church laptop (desktop app)

Installers are built by the **Desktop app release** GitHub Actions workflow. Push a version tag and download the `.dmg` (macOS) and `Setup.exe` (Windows) from the GitHub release:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

To build locally instead, run `./scripts/build_desktop.sh` on a Mac (makes the `.dmg`) or in Git Bash on Windows with [Inno Setup](https://jrsoftware.org/isinfo.php) installed (makes the installer). Output goes to `dist/`.

Setting up a laptop:

1. Install the app. On macOS, drag it to Applications. On Windows, run the installer, which also allows the server through the Windows firewall.
2. Open it, paste the cloud admin address and its `SYNC_TOKEN`, press **Test connection**, then **Save and continue**.
3. Each service, flip the switch to turn the server on. Workers scan the QR code. Afterwards, turn it off and close the app.

Closing the window while the server is on asks whether to keep it running in the menu bar (macOS) or system tray (Windows). Quitting always stops the server.

The apps are not code signed, so the first launch shows a warning:

- **macOS:** right-click the app in Applications, choose **Open**, then **Open** again. Only needed once.
- **Windows:** on the SmartScreen prompt, choose **More info**, then **Run anyway**.

Also:

- Reserve a fixed IP for the laptop on the church router, so the QR code and address never change.
- Make sure the church Wi-Fi has client isolation turned off, or phones cannot reach the laptop.
- Keep the laptop plugged in and stop it from sleeping during service.
