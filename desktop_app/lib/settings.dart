import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

const defaultPort = 8080;

class AppSettings {
  const AppSettings({
    this.cloudUrl = '',
    this.syncToken = '',
    this.port = defaultPort,
    this.startOnLaunch = false,
  });

  final String cloudUrl;
  final String syncToken;
  final int port;

  /// Turn the server on as soon as the app opens.
  final bool startOnLaunch;

  bool get isConfigured => cloudUrl.isNotEmpty && syncToken.isNotEmpty;

  AppSettings copyWith({
    String? cloudUrl,
    String? syncToken,
    int? port,
    bool? startOnLaunch,
  }) => AppSettings(
    cloudUrl: cloudUrl ?? this.cloudUrl,
    syncToken: syncToken ?? this.syncToken,
    port: port ?? this.port,
    startOnLaunch: startOnLaunch ?? this.startOnLaunch,
  );

  Map<String, Object> toJson() => {
    'cloud_url': cloudUrl,
    'sync_token': syncToken,
    'port': port,
    'start_on_launch': startOnLaunch,
  };

  factory AppSettings.fromJson(Map<String, dynamic> json) => AppSettings(
    cloudUrl: json['cloud_url'] as String? ?? '',
    syncToken: json['sync_token'] as String? ?? '',
    port: json['port'] as int? ?? defaultPort,
    startOnLaunch: json['start_on_launch'] as bool? ?? false,
  );
}

/// Trims, adds https:// when no scheme is given, and drops trailing slashes.
String normalizeCloudUrl(String input) {
  var url = input.trim();
  if (url.isEmpty) return url;
  if (!url.contains('://')) url = 'https://$url';
  while (url.endsWith('/')) {
    url = url.substring(0, url.length - 1);
  }
  return url;
}

/// Persists settings next to the local database in the app's data folder.
class SettingsStore {
  SettingsStore(this.dataDir);

  final Directory dataDir;

  static Future<SettingsStore> open() async {
    final dir = await getApplicationSupportDirectory();
    await dir.create(recursive: true);
    return SettingsStore(dir);
  }

  File get _file => File('${dataDir.path}${Platform.pathSeparator}settings.json');

  String get databasePath =>
      '${dataDir.path}${Platform.pathSeparator}attendance.db';

  Future<AppSettings> load() async {
    try {
      final raw = await _file.readAsString();
      return AppSettings.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return const AppSettings();
    }
  }

  Future<void> save(AppSettings settings) async {
    final tmp = File('${_file.path}.tmp');
    await tmp.writeAsString(
      const JsonEncoder.withIndent('  ').convert(settings.toJson()),
    );
    await tmp.rename(_file.path);
  }
}
