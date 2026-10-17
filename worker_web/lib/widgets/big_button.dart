import 'package:flutter/material.dart';

import '../theme.dart';

/// Full-width primary action. While [busy] it keeps the brand colour, shows a
/// spinner and ignores taps.
class BigButton extends StatelessWidget {
  const BigButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
    this.height = 56,
    this.fontSize = 18,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final double height;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: busy ? null : onPressed,
      style: FilledButton.styleFrom(
        minimumSize: Size.fromHeight(height),
        disabledBackgroundColor: busy ? Brand.primary : null,
        disabledForegroundColor: busy ? Colors.white : null,
        // ButtonStyle.textStyle replaces the theme's, so the bundled font
        // must be repeated; offline there is no Roboto fallback to load.
        textStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: fontSize,
          fontWeight: FontWeight.w700,
        ),
      ),
      child: busy
          ? const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: Colors.white,
                semanticsLabel: 'Please wait',
              ),
            )
          : Text(label),
    );
  }
}
