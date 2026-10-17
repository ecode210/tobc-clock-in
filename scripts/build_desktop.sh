#!/usr/bin/env bash
# Builds the TOBC Clock-In Server desktop app for the current OS with the Go
# server bundled inside it.
#   macOS:   dist/TOBC-Clock-In-Server-<version>-macOS.dmg
#   Windows: dist/TOBC-Clock-In-Server-<version>-Windows-Setup.exe (needs Inno Setup)
# Run from Git Bash on Windows.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/desktop_app"
DIST="$ROOT/dist"
VERSION="${VERSION:-$(grep -E '^version:' "$APP/pubspec.yaml" | sed -E 's/version: *([^+]+).*/\1/')}"
LDFLAGS="-s -w"

case "$(uname -s)" in
  Darwin) OS=macos ;;
  MINGW*|MSYS*|CYGWIN*) OS=windows ;;
  *) echo "Unsupported OS: $(uname -s). Build on macOS or Windows." >&2; exit 1 ;;
esac

echo "==> Building the worker web app and embedding it in the server"
"$ROOT/scripts/build_all.sh"

mkdir -p "$DIST"

if [ "$OS" = macos ]; then
  echo "==> Building a universal server binary (Apple silicon and Intel)"
  (
    cd "$ROOT/backend"
    GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go build -tags embedweb -trimpath -ldflags "$LDFLAGS" -o bin/church-clockin-arm64 ./cmd/server
    GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go build -tags embedweb -trimpath -ldflags "$LDFLAGS" -o bin/church-clockin-amd64 ./cmd/server
    lipo -create -output bin/church-clockin-universal bin/church-clockin-arm64 bin/church-clockin-amd64
    rm bin/church-clockin-arm64 bin/church-clockin-amd64
  )

  echo "==> Building the macOS app"
  (cd "$APP" && flutter pub get && flutter build macos --release --build-name "$VERSION")
  BUNDLE="$APP/build/macos/Build/Products/Release/TOBC Clock-In Server.app"
  cp "$ROOT/backend/bin/church-clockin-universal" "$BUNDLE/Contents/Resources/church-clockin"
  chmod +x "$BUNDLE/Contents/Resources/church-clockin"

  echo "==> Signing (ad hoc)"
  codesign --force --sign - "$BUNDLE/Contents/Resources/church-clockin"
  codesign --force --deep --sign - "$BUNDLE"

  echo "==> Creating the disk image"
  STAGE="$(mktemp -d)"
  cp -R "$BUNDLE" "$STAGE/"
  ln -s /Applications "$STAGE/Applications"
  DMG="$DIST/TOBC-Clock-In-Server-$VERSION-macOS.dmg"
  rm -f "$DMG"
  hdiutil create -volname "TOBC Clock-In Server" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
  rm -rf "$STAGE"
  echo
  echo "Done: $DMG"
else
  echo "==> Building the Windows server binary"
  (
    cd "$ROOT/backend"
    GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -tags embedweb -trimpath -ldflags "$LDFLAGS -H=windowsgui" -o bin/church-clockin.exe ./cmd/server
  )

  echo "==> Building the Windows app"
  (cd "$APP" && flutter pub get && flutter build windows --release --build-name "$VERSION")
  RELEASE="$APP/build/windows/x64/runner/Release"
  cp "$ROOT/backend/bin/church-clockin.exe" "$RELEASE/church-clockin.exe"

  ISCC="${ISCC:-}"
  if [ -z "$ISCC" ]; then
    for c in iscc "/c/Program Files (x86)/Inno Setup 6/ISCC.exe" "/c/Program Files/Inno Setup 6/ISCC.exe"; do
      if command -v "$c" >/dev/null 2>&1 || [ -f "$c" ]; then ISCC="$c"; break; fi
    done
  fi
  if [ -z "$ISCC" ]; then
    echo "Inno Setup not found. The app is ready in $RELEASE but no installer was made." >&2
    exit 1
  fi

  echo "==> Creating the installer"
  "$ISCC" //Q "//DAppVersion=$VERSION" "//DSourceDir=$(cygpath -w "$RELEASE")" "//DOutputDir=$(cygpath -w "$DIST")" "$(cygpath -w "$APP/windows/installer.iss")"
  echo
  echo "Done: $DIST/TOBC-Clock-In-Server-$VERSION-Windows-Setup.exe"
fi
