import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:tobc_clockin_desktop/network.dart';
import 'package:tobc_clockin_desktop/settings.dart';

void main() {
  group('normalizeCloudUrl', () {
    test('adds https and strips trailing slashes', () {
      expect(normalizeCloudUrl(' admin.example.org/ '), 'https://admin.example.org');
      expect(normalizeCloudUrl('http://localhost:3000//'), 'http://localhost:3000');
      expect(normalizeCloudUrl(''), '');
    });
  });

  test('settings round trip through json', () {
    const s = AppSettings(cloudUrl: 'https://a.b', syncToken: 't', port: 9000, startOnLaunch: true);
    final back = AppSettings.fromJson(jsonDecode(jsonEncode(s.toJson())) as Map<String, dynamic>);
    expect(back.cloudUrl, s.cloudUrl);
    expect(back.syncToken, s.syncToken);
    expect(back.port, 9000);
    expect(back.startOnLaunch, isTrue);
    expect(AppSettings.fromJson({}).port, defaultPort);
    expect(const AppSettings().isConfigured, isFalse);
  });

  group('checkCloud', () {
    Future<CloudCheckResult> run(http.Response Function(http.Request) handler) =>
        checkCloud('https://admin.test', 'secret', client: MockClient((r) async => handler(r)));

    test('ok returns the worker count and sends the bearer token', () async {
      late http.Request seen;
      final res = await run((r) {
        seen = r;
        return http.Response(jsonEncode({'workers': [{}, {}, {}]}), 200);
      });
      expect(res.status, CloudCheck.ok);
      expect(res.workers, 3);
      expect(seen.url.toString(), 'https://admin.test/api/sync/workers');
      expect(seen.headers['Authorization'], 'Bearer secret');
    });

    test('401 is a bad token', () async {
      final res = await run((_) => http.Response('{"error":"unauthorized"}', 401));
      expect(res.status, CloudCheck.badToken);
    });

    test('non json 200 or 404 is not a cloud admin', () async {
      expect((await run((_) => http.Response('<html>', 200))).status, CloudCheck.notFound);
      expect((await run((_) => http.Response('nope', 404))).status, CloudCheck.notFound);
    });

    test('network errors are unreachable', () async {
      final res = await checkCloud(
        'https://admin.test',
        'secret',
        client: MockClient((_) async => throw http.ClientException('offline')),
      );
      expect(res.status, CloudCheck.unreachable);
    });
  });
}
