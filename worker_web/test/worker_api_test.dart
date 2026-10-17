import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_web/api/token_store.dart';
import 'package:worker_web/api/worker_api.dart';
import 'package:worker_web/format.dart';

void main() {
  final base = Uri.parse('http://192.168.1.10:8080');

  group('HttpWorkerApi', () {
    test('status sends X-Device-Token and parses registered shape', () async {
      late http.Request seen;
      final api = HttpWorkerApi(
        baseUri: base,
        tokenStore: MemoryTokenStore('abc'),
        client: MockClient((req) async {
          seen = req;
          return http.Response(
            jsonEncode({
              'registered': true,
              'device_token': 'abc',
              'worker': {
                'id': 3,
                'name': 'Ada',
                'department': 'Choir',
                'username': 'ada',
              },
              'clocked_in_today': true,
              'clocked_in_at': '2026-10-18 07:14:09',
            }),
            200,
          );
        }),
      );

      final status = await api.status();
      expect(seen.method, 'GET');
      expect(
        seen.url.toString(),
        'http://192.168.1.10:8080/api/v1/worker/status',
      );
      expect(seen.headers['X-Device-Token'], 'abc');
      expect(status.registered, isTrue);
      expect(status.deviceToken, 'abc');
      expect(status.worker!.id, '3');
      expect(status.worker!.department, 'Choir');
      expect(status.clockedInToday, isTrue);
      expect(status.clockedInAt, DateTime(2026, 10, 18, 7, 14, 9));
    });

    test('status without a token omits the header', () async {
      late http.Request seen;
      final api = HttpWorkerApi(
        baseUri: base,
        tokenStore: MemoryTokenStore(),
        client: MockClient((req) async {
          seen = req;
          return http.Response('{"registered": false}', 200);
        }),
      );
      final status = await api.status();
      expect(seen.headers.containsKey('X-Device-Token'), isFalse);
      expect(status.registered, isFalse);
      expect(status.worker, isNull);
    });

    test('register posts username and setup_code', () async {
      late http.Request seen;
      final api = HttpWorkerApi(
        baseUri: base,
        tokenStore: MemoryTokenStore(),
        client: MockClient((req) async {
          seen = req;
          return http.Response(
            jsonEncode({
              'registered': true,
              'device_token': 't',
              'worker': {
                'id': 1,
                'name': 'A',
                'department': 'B',
                'username': 'a',
              },
              'clocked_in_today': false,
              'clocked_in_at': null,
            }),
            200,
          );
        }),
      );
      final status = await api.register(username: 'a', setupCode: 'ABC234');
      expect(seen.method, 'POST');
      expect(seen.url.path, '/api/v1/worker/register');
      expect(seen.headers['Content-Type'], startsWith('application/json'));
      expect(jsonDecode(seen.body), {'username': 'a', 'setup_code': 'ABC234'});
      expect(status.clockedInAt, isNull);
    });

    test('clock-in posts {} with token and parses result', () async {
      late http.Request seen;
      final api = HttpWorkerApi(
        baseUri: base,
        tokenStore: MemoryTokenStore('tok'),
        client: MockClient((req) async {
          seen = req;
          return http.Response(
            jsonEncode({
              'already_clocked_in': true,
              'clock_in_date': '2026-10-18',
              'clocked_in_at': '2026-10-18 07:14:00',
              'worker': {
                'id': 1,
                'name': 'A',
                'department': 'B',
                'username': 'a',
              },
            }),
            200,
          );
        }),
      );
      final result = await api.clockIn();
      expect(seen.url.path, '/api/v1/worker/clock-in');
      expect(seen.body, '{}');
      expect(seen.headers['X-Device-Token'], 'tok');
      expect(result.alreadyClockedIn, isTrue);
      expect(result.clockInDate, '2026-10-18');
      expect(result.clockedInAt, DateTime(2026, 10, 18, 7, 14));
    });

    test('error responses surface the server message', () async {
      final api = HttpWorkerApi(
        baseUri: base,
        tokenStore: MemoryTokenStore(),
        client: MockClient(
          (_) async => http.Response('{"error": "Invalid setup code"}', 401),
        ),
      );
      expect(
        () => api.register(username: 'a', setupCode: 'XXXXXX'),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'statusCode', 401)
              .having((e) => e.message, 'message', 'Invalid setup code'),
        ),
      );
    });

    test('non-JSON error falls back to a generic message', () async {
      final api = HttpWorkerApi(
        baseUri: base,
        tokenStore: MemoryTokenStore(),
        client: MockClient((_) async => http.Response('Bad Gateway', 502)),
      );
      expect(
        api.status,
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            contains('502'),
          ),
        ),
      );
    });

    test('connection failures become NetworkException', () async {
      final api = HttpWorkerApi(
        baseUri: base,
        tokenStore: MemoryTokenStore(),
        client: MockClient((_) async => throw http.ClientException('refused')),
      );
      expect(api.status, throwsA(isA<NetworkException>()));
    });

    test('timeouts become NetworkException', () async {
      final api = HttpWorkerApi(
        baseUri: base,
        tokenStore: MemoryTokenStore(),
        timeout: const Duration(milliseconds: 10),
        client: MockClient((_) async {
          await Future<void>.delayed(const Duration(milliseconds: 200));
          return http.Response('{}', 200);
        }),
      );
      expect(api.status, throwsA(isA<NetworkException>()));
    });
  });

  group('SharedPrefsTokenStore', () {
    test('persists under device_token', () async {
      SharedPreferences.setMockInitialValues({});
      final store = SharedPrefsTokenStore();
      expect(await store.read(), isNull);
      await store.write('xyz');
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('device_token'), 'xyz');
      expect(await store.read(), 'xyz');
      await store.clear();
      expect(await store.read(), isNull);
    });
  });

  test('formatClockTime', () {
    expect(
      formatClockTime(DateTime(2026, 10, 18, 7, 14)),
      'Sunday, Oct 18 at 07:14 AM',
    );
    expect(
      formatClockTime(DateTime(2026, 10, 25, 13, 2)),
      'Sunday, Oct 25 at 01:02 PM',
    );
  });
}
