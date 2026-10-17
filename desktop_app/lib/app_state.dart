import 'dart:async';

import 'package:flutter/foundation.dart';

import 'network.dart';
import 'server_controller.dart';
import 'settings.dart';

class AppState extends ChangeNotifier {
  AppState._(this._store, this._settings)
    : server = ServerController(databasePath: _store.databasePath) {
    server.addListener(notifyListeners);
  }

  static Future<AppState> load() async {
    final store = await SettingsStore.open();
    final settings = await store.load();
    final state = AppState._(store, settings);
    await state.refreshAddresses();
    return state;
  }

  final SettingsStore _store;
  final ServerController server;

  AppSettings _settings;
  AppSettings get settings => _settings;

  List<LanAddress> _addresses = const [];
  List<LanAddress> get addresses => _addresses;

  String? _selectedIp;
  String? get ip {
    if (_selectedIp != null && _addresses.any((a) => a.ip == _selectedIp)) {
      return _selectedIp;
    }
    return _addresses.isEmpty ? null : _addresses.first.ip;
  }

  String? get workerUrl {
    final host = ip;
    if (host == null) return null;
    return _settings.port == 80 ? 'http://$host' : 'http://$host:${_settings.port}';
  }

  String get dataFolder => _store.dataDir.path;

  void selectIp(String ip) {
    _selectedIp = ip;
    notifyListeners();
  }

  Future<void> refreshAddresses() async {
    try {
      _addresses = await lanAddresses();
    } catch (_) {
      _addresses = const [];
    }
    notifyListeners();
  }

  Future<void> startServer() async {
    await refreshAddresses();
    await server.start(_settings);
  }

  Future<void> stopServer() => server.stop();

  /// Saves new settings, restarting the server if it is on so they apply.
  Future<void> saveSettings(AppSettings next) async {
    final wasRunning = server.isRunning;
    final needsRestart =
        wasRunning &&
        (next.cloudUrl != _settings.cloudUrl ||
            next.syncToken != _settings.syncToken ||
            next.port != _settings.port);
    _settings = next;
    await _store.save(next);
    server.clearError();
    notifyListeners();
    if (needsRestart) {
      await server.stop();
      unawaited(startServer());
    }
  }

  @override
  void dispose() {
    server.removeListener(notifyListeners);
    server.dispose();
    super.dispose();
  }
}
