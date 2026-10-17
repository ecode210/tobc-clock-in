import 'dart:async';

import 'package:flutter/material.dart';
import 'package:window_manager/window_manager.dart';

import 'app_state.dart';
import 'screens/home_screen.dart';
import 'screens/setup_screen.dart';
import 'theme.dart';
import 'tray.dart';
import 'widgets.dart';

const appTitle = 'TOBC Clock-In Server';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await windowManager.ensureInitialized();
  final app = await AppState.load();

  const options = WindowOptions(
    title: appTitle,
    size: Size(1040, 780),
    minimumSize: Size(720, 620),
    center: true,
    backgroundColor: Brand.canvas,
  );
  unawaited(
    windowManager.waitUntilReadyToShow(options, () async {
      await windowManager.show();
      await windowManager.focus();
    }),
  );
  await windowManager.setPreventClose(true);

  runApp(ClockInApp(app: app));
}

class ClockInApp extends StatefulWidget {
  const ClockInApp({super.key, required this.app});

  final AppState app;

  @override
  State<ClockInApp> createState() => _ClockInAppState();
}

class _ClockInAppState extends State<ClockInApp> with WindowListener {
  final _navigatorKey = GlobalKey<NavigatorState>();
  late final TrayController _tray;
  bool _quitting = false;

  AppState get app => widget.app;

  @override
  void initState() {
    super.initState();
    windowManager.addListener(this);
    _tray = TrayController(app: app, onShow: _showWindow, onQuit: _quit);
    unawaited(_tray.init());
    if (app.settings.isConfigured && app.settings.startOnLaunch) {
      unawaited(app.startServer());
    }
  }

  @override
  void dispose() {
    windowManager.removeListener(this);
    unawaited(_tray.dispose());
    super.dispose();
  }

  Future<void> _showWindow() async {
    await windowManager.show();
    await windowManager.focus();
  }

  Future<void> _quit() async {
    if (_quitting) return;
    _quitting = true;
    await app.stopServer();
    await _tray.dispose();
    await windowManager.setPreventClose(false);
    await windowManager.destroy();
  }

  @override
  void onWindowClose() async {
    final server = app.server;
    if (!server.isRunning && !server.isBusy) {
      await _quit();
      return;
    }
    final context = _navigatorKey.currentContext;
    if (context == null) return;
    final choice = await showBrandDialog<String>(
      context: context,
      title: 'The server is still on',
      subtitle: 'Keep it running in the background, or turn it off and quit.',
      builder: (ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FilledButton(
            onPressed: () => Navigator.pop(ctx, 'keep'),
            child: const Text('Keep running'),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () => Navigator.pop(ctx, 'quit'),
            child: const Text('Turn off and quit'),
          ),
        ],
      ),
    );
    switch (choice) {
      case 'keep':
        await windowManager.hide();
      case 'quit':
        await _quit();
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: appTitle,
      navigatorKey: _navigatorKey,
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: ListenableBuilder(
        listenable: app,
        builder: (context, _) => app.settings.isConfigured
            ? HomeScreen(app: app)
            : SetupScreen(app: app, firstRun: true),
      ),
    );
  }
}
