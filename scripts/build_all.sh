#!/usr/bin/env bash
# Builds the Flutter worker web app and the Go laptop server binary.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Building worker_web (Flutter web)"
(cd "$ROOT/worker_web" && flutter pub get && flutter build web --no-web-resources-cdn)

echo "==> Removing unused Google CDN defaults from build/web"
# web/flutter_bootstrap.js always sets canvasKitBaseUrl and fontFallbackBaseUrl,
# so these engine defaults are dead code. Rewrite them to the same local paths
# so the bundle never references a Google host.
WEB_OUT="$ROOT/worker_web/build/web"
for f in "$WEB_OUT/flutter.js" "$WEB_OUT/flutter_bootstrap.js" "$WEB_OUT/main.dart.js"; do
  [ -f "$f" ] || continue
  # -i.bak works with both BSD (macOS) and GNU sed.
  sed -i.bak \
    -e 's|https://www\.gstatic\.com/flutter-canvaskit|canvaskit|g' \
    -e 's|https://fonts\.gstatic\.com/s/|assets/fallback-fonts/|g' \
    "$f"
  rm -f "$f.bak"
done
if leftovers="$(grep -rlE 'fonts\.googleapis\.com|fonts\.gstatic\.com|gstatic\.com' "$WEB_OUT")"; then
  echo "ERROR: build/web still references Google CDN hosts:" >&2
  echo "$leftovers" >&2
  exit 1
fi

echo "==> Building backend/bin/church-clockin"
(cd "$ROOT/backend" && go build -o bin/church-clockin ./cmd/server)

echo
echo "Done. Run from the repo root:"
echo "  ./backend/bin/church-clockin --web-dir worker_web/build/web --db-path backend/attendance.db --cloud-url \"\$CLOUD_URL\" --sync-token \"\$SYNC_TOKEN\""
