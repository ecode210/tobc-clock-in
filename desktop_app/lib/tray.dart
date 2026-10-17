import 'dart:io';

import 'package:tray_manager/tray_manager.dart';

import 'app_state.dart';
import 'server_controller.dart';

/// Menu bar (macOS) or system tray (Windows) icon that keeps the app
/// reachable while its window is hidden.
class TrayController with TrayListener {
  TrayController({required this.app, required this.onShow, required this.onQuit});

  final AppState app;
  final Future<void> Function() onShow;
  final Future<void> Function() onQuit;

  ServerState? _shownState;

  Future<void> init() async {
    trayManager.addListener(this);
    await trayManager.setIcon(
      Platform.isWindows ? 'assets/tray/tray_color.ico' : 'assets/tray/tray_template.png',
      isTemplate: Platform.isMacOS,
    );
    app.addListener(_sync);
    await _sync();
  }

  bool _disposed = false;

  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    app.removeListener(_sync);
    trayManager.removeListener(this);
    await trayManager.destroy();
  }

  Future<void> _sync() async {
    final state = app.server.state;
    if (state == _shownState) return;
    _shownState = state;

    final status = switch (state) {
      ServerState.running => 'Server is on',
      ServerState.starting => 'Turning on',
      ServerState.stopping => 'Turning off',
      ServerState.stopped => 'Server is off',
      ServerState.failed => 'Server is off (problem)',
    };
    final busy = state == ServerState.starting || state == ServerState.stopping;
    final running = state == ServerState.running;

    await trayManager.setToolTip('TOBC Clock-In Server: $status');
    await trayManager.setContextMenu(
      Menu(
        items: [
          MenuItem(label: status, disabled: true),
          MenuItem.separator(),
          MenuItem(key: 'show', label: 'Open TOBC Clock-In Server'),
          MenuItem(
            key: 'toggle',
            label: running ? 'Turn off server' : 'Turn on server',
            disabled: busy || !app.settings.isConfigured,
          ),
          MenuItem.separator(),
          MenuItem(key: 'quit', label: 'Quit'),
        ],
      ),
    );
  }

  @override
  void onTrayIconMouseDown() {
    if (Platform.isWindows) {
      onShow();
    } else {
      trayManager.popUpContextMenu();
    }
  }

  @override
  void onTrayIconRightMouseDown() {
    trayManager.popUpContextMenu();
  }

  @override
  void onTrayMenuItemClick(MenuItem menuItem) {
    switch (menuItem.key) {
      case 'show':
        onShow();
      case 'toggle':
        if (app.server.isRunning) {
          app.stopServer();
        } else {
          app.startServer();
        }
      case 'quit':
        onQuit();
    }
  }
}
