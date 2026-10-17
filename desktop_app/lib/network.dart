import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

class LanAddress {
  const LanAddress(this.ip, this.interfaceName);
  final String ip;
  final String interfaceName;
}

/// The laptop's IPv4 addresses that phones on the same Wi-Fi can reach,
/// best guess first.
Future<List<LanAddress>> lanAddresses() async {
  final interfaces = await NetworkInterface.list(
    type: InternetAddressType.IPv4,
    includeLoopback: false,
  );
  final found = <LanAddress>[];
  for (final iface in interfaces) {
    if (_isVirtual(iface.name)) continue;
    for (final addr in iface.addresses) {
      if (addr.isLoopback || addr.isLinkLocal) continue;
      found.add(LanAddress(addr.address, iface.name));
    }
  }
  found.sort((a, b) => _score(b).compareTo(_score(a)));
  return found;
}

bool _isVirtual(String name) {
  final n = name.toLowerCase();
  return n.startsWith('utun') ||
      n.startsWith('bridge') ||
      n.startsWith('vmnet') ||
      n.startsWith('docker') ||
      n.startsWith('veth') ||
      n.startsWith('awdl') ||
      n.startsWith('llw') ||
      n.contains('virtualbox') ||
      n.contains('vmware') ||
      n.contains('vethernet') ||
      n.contains('loopback');
}

int _score(LanAddress a) {
  var score = 0;
  final ip = a.ip;
  if (ip.startsWith('192.168.')) score += 30;
  if (ip.startsWith('10.')) score += 20;
  if (RegExp(r'^172\.(1[6-9]|2\d|3[01])\.').hasMatch(ip)) score += 20;
  final n = a.interfaceName.toLowerCase();
  if (n == 'en0' || n.contains('wi-fi') || n.contains('wlan') || n.contains('wireless')) {
    score += 10;
  }
  return score;
}

enum CloudCheck { ok, badToken, notFound, unreachable, error }

class CloudCheckResult {
  const CloudCheckResult(this.status, {this.workers, this.detail});
  final CloudCheck status;
  final int? workers;
  final String? detail;
}

/// Confirms the cloud admin URL and sync token work by fetching the worker list.
Future<CloudCheckResult> checkCloud(
  String cloudUrl,
  String token, {
  http.Client? client,
}) async {
  final c = client ?? http.Client();
  try {
    final res = await c
        .get(
          Uri.parse('$cloudUrl/api/sync/workers'),
          headers: {'Authorization': 'Bearer $token'},
        )
        .timeout(const Duration(seconds: 12));
    switch (res.statusCode) {
      case 200:
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        final workers = (body['workers'] as List?)?.length ?? 0;
        return CloudCheckResult(CloudCheck.ok, workers: workers);
      case 401:
        return const CloudCheckResult(CloudCheck.badToken);
      case 404:
        return const CloudCheckResult(CloudCheck.notFound);
      default:
        return CloudCheckResult(
          CloudCheck.error,
          detail: 'The cloud admin answered with status ${res.statusCode}.',
        );
    }
  } on FormatException {
    return const CloudCheckResult(CloudCheck.notFound);
  } catch (e) {
    return CloudCheckResult(CloudCheck.unreachable, detail: '$e');
  } finally {
    if (client == null) c.close();
  }
}
