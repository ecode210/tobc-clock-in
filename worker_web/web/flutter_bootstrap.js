{{flutter_js}}
{{flutter_build_config}}

// Fully offline: CanvasKit is served from this build and missing-glyph
// fallback fonts never leave the LAN.
_flutter.loader.load({
  config: {
    canvasKitBaseUrl: "canvaskit/",
    fontFallbackBaseUrl: "assets/fallback-fonts/",
  },
});
