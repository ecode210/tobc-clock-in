import 'package:flutter/material.dart';

class Brand {
  static const primary = Color(0xFFF8096D);
  static const secondary = Color(0xFFCE23FC);
  static const surface = Color(0xFFFFFFFF);
  static const canvas = Color(0xFFF2F0F6);
  static const field = Color(0xFFF4F2F7);
  static const ink = Color(0xFF16131C);
  static const muted = Color(0xFF615C6B);
  static const outline = Color(0xFFE4E0EA);
}

const fontFamily = 'SourceSans3';

ThemeData buildTheme() {
  final scheme =
      ColorScheme.fromSeed(
        seedColor: Brand.primary,
        brightness: Brightness.light,
      ).copyWith(
        primary: Brand.primary,
        onPrimary: Colors.white,
        secondary: Brand.secondary,
        onSecondary: Colors.white,
        surface: Brand.surface,
        onSurface: Brand.ink,
        onSurfaceVariant: Brand.muted,
        outline: Brand.outline,
      );

  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: scheme,
    fontFamily: fontFamily,
    scaffoldBackgroundColor: Brand.canvas,
    splashFactory: InkRipple.splashFactory,
  );

  final text = base.textTheme.apply(
    fontFamily: fontFamily,
    bodyColor: Brand.ink,
    displayColor: Brand.ink,
  );

  final inputRadius = BorderRadius.circular(999);

  return base.copyWith(
    textTheme: text.copyWith(
      headlineMedium: text.headlineMedium?.copyWith(
        fontWeight: FontWeight.w700,
        fontSize: 28,
        height: 1.2,
        letterSpacing: -0.2,
      ),
      titleMedium: text.titleMedium?.copyWith(
        fontWeight: FontWeight.w600,
        fontSize: 17,
        height: 1.3,
      ),
      bodyLarge: text.bodyLarge?.copyWith(fontSize: 17, height: 1.4),
      bodyMedium: text.bodyMedium?.copyWith(fontSize: 16, height: 1.4),
      labelLarge: text.labelLarge?.copyWith(
        fontSize: 15,
        fontWeight: FontWeight.w600,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Brand.field,
      // Touch browsers can leave a sticky hover state behind after a tap.
      hoverColor: Colors.transparent,
      hintStyle: const TextStyle(color: Color(0xFF9A95A3)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: inputRadius,
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: inputRadius,
        borderSide: BorderSide.none,
      ),
      disabledBorder: OutlineInputBorder(
        borderRadius: inputRadius,
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: inputRadius,
        borderSide: const BorderSide(color: Brand.primary, width: 2),
      ),
    ),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: Brand.primary,
      selectionColor: Brand.primary.withValues(alpha: 0.2),
      selectionHandleColor: Brand.primary,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Brand.primary,
        foregroundColor: Colors.white,
        disabledBackgroundColor: Brand.outline,
        disabledForegroundColor: Brand.muted,
        minimumSize: const Size.fromHeight(56),
        elevation: 0,
        shape: const StadiumBorder(),
        textStyle: const TextStyle(
          fontFamily: fontFamily,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: Brand.primary,
    ),
  );
}
