import 'package:flutter/material.dart';

class Brand {
  static const primary = Color(0xFFF8096D);
  static const primarySoft = Color(0xFFFFE8F1);
  static const secondary = Color(0xFFCE23FC);
  static const surface = Color(0xFFFFFFFF);
  static const canvas = Color(0xFFF2F0F6);
  static const field = Color(0xFFF4F2F7);
  static const ink = Color(0xFF16131C);
  static const muted = Color(0xFF615C6B);
  static const outline = Color(0xFFE4E0EA);
  static const success = Color(0xFF12A150);
  static const successSoft = Color(0xFFE6F6EC);
  static const warning = Color(0xFFB45309);
  static const warningSoft = Color(0xFFFEF3C7);
  static const danger = Color(0xFFDC2626);
  static const dangerSoft = Color(0xFFFEE2E2);
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
    visualDensity: VisualDensity.standard,
  );

  final text = base.textTheme.apply(
    fontFamily: fontFamily,
    bodyColor: Brand.ink,
    displayColor: Brand.ink,
  );

  final pill = BorderRadius.circular(999);

  return base.copyWith(
    textTheme: text.copyWith(
      headlineMedium: text.headlineMedium?.copyWith(
        fontWeight: FontWeight.w700,
        fontSize: 26,
        height: 1.2,
        letterSpacing: -0.2,
      ),
      titleLarge: text.titleLarge?.copyWith(
        fontWeight: FontWeight.w700,
        fontSize: 20,
      ),
      titleMedium: text.titleMedium?.copyWith(
        fontWeight: FontWeight.w600,
        fontSize: 16,
        height: 1.3,
      ),
      bodyLarge: text.bodyLarge?.copyWith(fontSize: 16, height: 1.4),
      bodyMedium: text.bodyMedium?.copyWith(fontSize: 15, height: 1.4),
      labelLarge: text.labelLarge?.copyWith(
        fontSize: 15,
        fontWeight: FontWeight.w600,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Brand.field,
      hintStyle: const TextStyle(color: Color(0xFF9A95A3)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
      border: OutlineInputBorder(borderRadius: pill, borderSide: BorderSide.none),
      enabledBorder: OutlineInputBorder(
        borderRadius: pill,
        borderSide: BorderSide.none,
      ),
      disabledBorder: OutlineInputBorder(
        borderRadius: pill,
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: pill,
        borderSide: const BorderSide(color: Brand.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: pill,
        borderSide: const BorderSide(color: Brand.danger, width: 1.5),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: pill,
        borderSide: const BorderSide(color: Brand.danger, width: 2),
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
        minimumSize: const Size(0, 48),
        padding: const EdgeInsets.symmetric(horizontal: 24),
        elevation: 0,
        shape: const StadiumBorder(),
        textStyle: const TextStyle(
          fontFamily: fontFamily,
          fontSize: 16,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: Brand.ink,
        minimumSize: const Size(0, 48),
        padding: const EdgeInsets.symmetric(horizontal: 22),
        side: const BorderSide(color: Brand.outline, width: 1.5),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(
          fontFamily: fontFamily,
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: Brand.primary,
        shape: const StadiumBorder(),
        textStyle: const TextStyle(
          fontFamily: fontFamily,
          fontSize: 15,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.selected) ? Colors.white : Brand.muted,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.selected) ? Brand.primary : Brand.field,
      ),
      trackOutlineColor: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.selected)
            ? Brand.primary
            : Brand.outline,
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: Brand.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      width: 420,
      backgroundColor: Brand.ink,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: Brand.primary,
    ),
  );
}
