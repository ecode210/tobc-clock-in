import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';
import 'token_store.dart';

/// The server answered with a non-2xx status.
class ApiException implements Exception {
  const ApiException(this.statusCode, this.message);

  final int statusCode;
  final String message;

  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// The server could not be reached at all.
class NetworkException implements Exception {
  const NetworkException([this.cause]);

  final Object? cause;

  @override
  String toString() => 'NetworkException: $cause';
}

abstract class WorkerApi {
  Future<WorkerStatus> status();
  Future<WorkerStatus> register({
    required String username,
    required String setupCode,
  });
  Future<ClockInResult> clockIn();
}

/// Resolves the API base: `--dart-define=API_BASE=...` wins, else the page origin.
Uri resolveApiBase() {
  const override = String.fromEnvironment('API_BASE');
  if (override.isNotEmpty) return Uri.parse(override);
  final base = Uri.base;
  if (base.scheme == 'http' || base.scheme == 'https') {
    return Uri.parse(base.origin);
  }
  return Uri.parse('http://127.0.0.1:8080');
}

class HttpWorkerApi implements WorkerApi {
  HttpWorkerApi({
    required this.baseUri,
    required this.tokenStore,
    http.Client? client,
    this.timeout = const Duration(seconds: 15),
  }) : _client = client ?? http.Client();

  static const tokenHeader = 'X-Device-Token';

  final Uri baseUri;
  final TokenStore tokenStore;
  final Duration timeout;
  final http.Client _client;

  Uri _uri(String path) => baseUri.replace(path: '/api/v1/worker/$path');

  Future<Map<String, String>> _headers({bool json = false}) async {
    final token = await tokenStore.read();
    return {
      'Accept': 'application/json',
      if (json) 'Content-Type': 'application/json',
      tokenHeader: ?token,
    };
  }

  Future<Map<String, dynamic>> _send(
    Future<http.Response> Function() request,
  ) async {
    final http.Response response;
    try {
      response = await request().timeout(timeout);
    } on TimeoutException catch (e) {
      throw NetworkException(e);
    } on http.ClientException catch (e) {
      throw NetworkException(e);
    }

    Object? body;
    try {
      body = response.body.isEmpty ? null : jsonDecode(response.body);
    } on FormatException {
      body = null;
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (body is Map<String, dynamic>) return body;
      throw ApiException(
        response.statusCode,
        'The server sent an unexpected response.',
      );
    }

    final message = body is Map<String, dynamic> && body['error'] is String
        ? body['error'] as String
        : 'Something went wrong (HTTP ${response.statusCode}).';
    throw ApiException(response.statusCode, message);
  }

  @override
  Future<WorkerStatus> status() async {
    final headers = await _headers();
    final json = await _send(
      () => _client.get(_uri('status'), headers: headers),
    );
    return WorkerStatus.fromJson(json);
  }

  @override
  Future<WorkerStatus> register({
    required String username,
    required String setupCode,
  }) async {
    final headers = await _headers(json: true);
    final json = await _send(
      () => _client.post(
        _uri('register'),
        headers: headers,
        body: jsonEncode({'username': username, 'setup_code': setupCode}),
      ),
    );
    return WorkerStatus.fromJson(json);
  }

  @override
  Future<ClockInResult> clockIn() async {
    final headers = await _headers(json: true);
    final json = await _send(
      () => _client.post(_uri('clock-in'), headers: headers, body: '{}'),
    );
    return ClockInResult.fromJson(json);
  }
}
