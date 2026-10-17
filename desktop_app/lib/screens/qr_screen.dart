import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:window_manager/window_manager.dart';

import '../theme.dart';

/// Opens the worker address as a screen-filling QR code.
Future<void> showQrFullScreen(BuildContext context, String url) {
  return Navigator.of(context).push(
    PageRouteBuilder<void>(
      opaque: true,
      transitionDuration: const Duration(milliseconds: 200),
      reverseTransitionDuration: const Duration(milliseconds: 150),
      pageBuilder: (_, _, _) => QrScreen(url: url),
      transitionsBuilder: (_, animation, _, child) =>
          FadeTransition(opacity: animation, child: child),
    ),
  );
}

class QrScreen extends StatefulWidget {
  const QrScreen({super.key, required this.url});

  final String url;

  @override
  State<QrScreen> createState() => _QrScreenState();
}

class _QrScreenState extends State<QrScreen> {
  bool _wasFullScreen = false;

  @override
  void initState() {
    super.initState();
    _enter();
  }

  Future<void> _enter() async {
    _wasFullScreen = await windowManager.isFullScreen();
    if (!_wasFullScreen) await windowManager.setFullScreen(true);
  }

  @override
  void dispose() {
    if (!_wasFullScreen) windowManager.setFullScreen(false);
    super.dispose();
  }

  void _close() => Navigator.of(context).pop();

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return CallbackShortcuts(
      bindings: {const SingleActivator(LogicalKeyboardKey.escape): _close},
      child: Focus(
        autofocus: true,
        child: Scaffold(
          backgroundColor: Colors.white,
          body: SafeArea(
            child: LayoutBuilder(
              builder: (context, box) {
                final size = math.max(
                  160.0,
                  math.min(box.maxWidth - 96, box.maxHeight - 240),
                );
                return Stack(
                  children: [
                    Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Scan to clock in',
                            style: t.headlineMedium?.copyWith(fontSize: 34, fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 24),
                          QrImageView(
                            data: widget.url,
                            size: size,
                            padding: EdgeInsets.zero,
                            eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: Brand.ink),
                            dataModuleStyle: const QrDataModuleStyle(
                              dataModuleShape: QrDataModuleShape.square,
                              color: Brand.ink,
                            ),
                          ),
                          const SizedBox(height: 24),
                          Text(
                            widget.url,
                            style: t.headlineMedium?.copyWith(
                              color: Brand.primary,
                              fontSize: 30,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Positioned(
                      top: 20,
                      right: 20,
                      child: OutlinedButton.icon(
                        onPressed: _close,
                        icon: const Icon(Icons.fullscreen_exit_rounded),
                        label: const Text('Exit full screen'),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
