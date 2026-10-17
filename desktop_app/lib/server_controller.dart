import 'dart:async';
import 'dart:collection';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'settings.dart';

enum ServerState { stopped, starting, running, stopping, failed }

class ServerSummary {
  const ServerSummary({
    required this.workers,
    required this.devicesLocked,
    required this.clockedInToday,
    required this.pendingClockIns,
  });

  final int workers;
  final int devicesLocked;
  final int clockedInToday;
  final int pendingClockIns;

  factory ServerSummary.fromJson(Map<String, dynamic> j) => ServerSummary(
    workers: j['workers'] as int? ?? 0,
    devicesLocked: j['devices_locked'] as int? ?? 0,
    clockedInToday: j['clocked_in_today'] as int? ?? 0,
    pendingClockIns: j['pending_clock_ins'] as int? ?? 0,
  );
}

class SyncInfo {
  const SyncInfo({
    required this.online,
    this.lastSuccessAt,
    this.lastAttemptAt,
    this.lastError,
  });

  final bool online;
  final DateTime? lastSuccessAt;
  final DateTime? lastAttemptAt;
  final String? lastError;

  factory SyncInfo.fromJson(Map<String, dynamic> j) => SyncInfo(
    online: j['online'] as bool? ?? false,
    lastSuccessAt: DateTime.tryParse(j['last_success_at'] as String? ?? '')?.toLocal(),
    lastAttemptAt: DateTime.tryParse(j['last_attempt_at'] as String? ?? '')?.toLocal(),
    lastError: (j['last_error'] as String?)?.trim().isEmpty ?? true
        ? null
        : j['last_error'] as String,
  );
}

/// Finds the church-clockin server binary shipped with the app, or the one
/// built in the repo during development.
String? locateServerBinary() {
  final exe = Platform.isWindows ? 'church-clockin.exe' : 'church-clockin';
  final sep = Platform.pathSeparator;
  final override = Platform.environment['TOBC_SERVER_BIN'];
  final candidates = <String>[
    if (override != null && override.isNotEmpty) override,
  ];
  final appDir = File(Platform.resolvedExecutable).parent;
  if (Platform.isMacOS) {
    candidates.add('${appDir.parent.path}${sep}Resources$sep$exe');
  }
  candidates.add('${appDir.path}$sep$exe');

  var dir = Directory.current;
  for (var i = 0; i < 6; i++) {
    candidates.add('${dir.path}${sep}backend${sep}bin$sep$exe');
    if (dir.parent.path == dir.path) break;
    dir = dir.parent;
  }
  for (final path in candidates) {
    if (File(path).existsSync()) return path;
  }
  return null;
}

/// Runs the bundled Go server as a child process and reports its status.
class ServerController extends ChangeNotifier {
  ServerController({required this.databasePath, http.Client? client})
    : _http = client ?? http.Client();

  final String databasePath;
  final http.Client _http;

  static const _maxLogLines = 400;

  ServerState _state = ServerState.stopped;
  ServerState get state => _state;
  bool get isRunning => _state == ServerState.running;
  bool get isBusy =>
      _state == ServerState.starting || _state == ServerState.stopping;

  String? _error;
  String? get error => _error;

  int _port = defaultPort;
  int get port => _port;

  DateTime? _startedAt;
  DateTime? get startedAt => _startedAt;

  ServerSummary? _summary;
  ServerSummary? get summary => _summary;

  SyncInfo? _sync;
  SyncInfo? get sync => _sync;

  bool _syncing = false;
  bool get syncing => _syncing;

  final _logs = ListQueue<String>();
  List<String> get logs => List.unmodifiable(_logs);

  Process? _process;
  Timer? _poll;

  Uri _local(String path) => Uri.parse('http://127.0.0.1:$_port$path');

  void _setState(ServerState s, {String? error}) {
    _state = s;
    _error = error;
    notifyListeners();
  }

  void _log(String line) {
    final trimmed = line.trimRight();
    if (trimmed.isEmpty) return;
    _logs.addLast(trimmed);
    while (_logs.length > _maxLogLines) {
      _logs.removeFirst();
    }
    notifyListeners();
  }

  Future<void> start(AppSettings settings) async {
    if (_state == ServerState.running || isBusy) return;
    _port = settings.port;
    _summary = null;
    _sync = null;
    _setState(ServerState.starting);

    final binary = locateServerBinary();
    if (binary == null) {
      _setState(
        ServerState.failed,
        error: 'The server program is missing from this install. Reinstall TOBC Clock-In Server.',
      );
      return;
    }

    if (!await _portIsFree(_port)) {
      _setState(
        ServerState.failed,
        error: 'Port $_port is already in use by another program. Close it, or pick a different port in Settings.',
      );
      return;
    }

    final args = [
      '--port',
      '$_port',
      '--db-path',
      databasePath,
      '--exit-on-stdin-close',
      if (settings.cloudUrl.isNotEmpty) ...['--cloud-url', settings.cloudUrl],
      if (settings.syncToken.isNotEmpty) ...['--sync-token', settings.syncToken],
      '--sync-now',
    ];
    _log('Starting server on port $_port');

    final Process process;
    try {
      process = await Process.start(binary, args);
    } catch (e) {
      _setState(ServerState.failed, error: 'Could not start the server: $e');
      return;
    }
    _process = process;
    final recent = ListQueue<String>();
    void onLine(String line) {
      _log(line);
      recent.addLast(line);
      if (recent.length > 20) recent.removeFirst();
    }

    process.stdout.transform(utf8.decoder).transform(const LineSplitter()).listen(onLine);
    process.stderr.transform(utf8.decoder).transform(const LineSplitter()).listen(onLine);
    unawaited(
      process.exitCode.then((code) {
        if (!identical(_process, process)) return;
        _process = null;
        _poll?.cancel();
        _startedAt = null;
        if (_state == ServerState.stopping) {
          _log('Server stopped');
          _setState(ServerState.stopped);
        } else {
          _log('Server exited unexpectedly (code $code)');
          _setState(ServerState.failed, error: _explainExit(recent.toList()));
        }
      }),
    );

    final deadline = DateTime.now().add(const Duration(seconds: 15));
    while (DateTime.now().isBefore(deadline)) {
      if (_process == null) return;
      if (await _refresh()) {
        _startedAt = DateTime.now();
        _setState(ServerState.running);
        _poll = Timer.periodic(const Duration(seconds: 5), (_) => _refresh());
        return;
      }
      await Future<void>.delayed(const Duration(milliseconds: 300));
    }
    await _forceStop();
    _setState(ServerState.failed, error: 'The server did not start in time. Open the activity log for details.');
  }

  /// Hides a previous start failure, e.g. after the settings change.
  void clearError() {
    if (_state == ServerState.failed) _setState(ServerState.stopped);
  }

  Future<void> stop() async {
    final process = _process;
    if (process == null) {
      if (_state != ServerState.stopped) _setState(ServerState.stopped);
      return;
    }
    if (_state == ServerState.stopping) return;
    _poll?.cancel();
    _setState(ServerState.stopping);
    try {
      await _http
          .post(_local('/api/v1/local/shutdown'))
          .timeout(const Duration(seconds: 2));
    } catch (_) {}
    final exited = await process.exitCode
        .timeout(const Duration(seconds: 6), onTimeout: () => -1);
    if (exited == -1) await _forceStop();
  }

  Future<void> _forceStop() async {
    final process = _process;
    if (process == null) return;
    process.kill();
    await process.exitCode.timeout(const Duration(seconds: 3), onTimeout: () {
      process.kill(ProcessSignal.sigkill);
      return -1;
    });
  }

  /// Asks the server to sync with the cloud admin right away.
  Future<String> syncNow() async {
    if (!isRunning || _syncing) return '';
    _syncing = true;
    notifyListeners();
    try {
      final res = await _http
          .post(_local('/api/v1/sync'))
          .timeout(const Duration(seconds: 90));
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      await _refresh();
      if (body['ok'] == true) return 'Sync complete.';
      if (body['online'] == false) {
        return 'No internet right now. Clock-ins are saved and will sync later.';
      }
      final err = body['error'] as String?;
      return err == null || err.isEmpty ? 'Sync did not finish.' : 'Sync failed: $err';
    } catch (e) {
      return 'Sync failed: $e';
    } finally {
      _syncing = false;
      notifyListeners();
    }
  }

  Future<bool> _refresh() async {
    try {
      final res = await _http
          .get(_local('/api/v1/local/summary'))
          .timeout(const Duration(seconds: 2));
      if (res.statusCode != 200) return false;
      _summary = ServerSummary.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
      try {
        final s = await _http
            .get(_local('/api/v1/sync/status'))
            .timeout(const Duration(seconds: 2));
        if (s.statusCode == 200) {
          _sync = SyncInfo.fromJson(jsonDecode(s.body) as Map<String, dynamic>);
        }
      } catch (_) {}
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> _portIsFree(int port) async {
    try {
      final socket = await ServerSocket.bind(InternetAddress.anyIPv4, port);
      await socket.close();
      return true;
    } on SocketException {
      return false;
    }
  }

  static String _explainExit(List<String> lines) {
    final text = lines.join('\n').toLowerCase();
    if (text.contains('address already in use') || text.contains('only one usage of each socket address')) {
      return 'The port is already in use by another program. Pick a different port in Settings.';
    }
    if (text.contains('database') || text.contains('sqlite')) {
      return 'The server could not open its database. Open the activity log for details.';
    }
    return 'The server stopped unexpectedly. Open the activity log for details.';
  }

  @override
  void dispose() {
    _poll?.cancel();
    _process?.kill();
    _http.close();
    super.dispose();
  }
}
