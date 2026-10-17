class Worker {
  const Worker({
    required this.id,
    required this.name,
    required this.department,
    required this.username,
  });

  final String id;
  final String name;
  final String department;
  final String username;

  factory Worker.fromJson(Map<String, dynamic> json) => Worker(
    id: json['id']?.toString() ?? '',
    name: json['name'] as String? ?? '',
    department: json['department'] as String? ?? '',
    username: json['username'] as String? ?? '',
  );
}

/// Parses the server's local "YYYY-MM-DD HH:MM:SS" timestamp.
DateTime? parseServerTime(Object? value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value);
}

class WorkerStatus {
  const WorkerStatus({
    required this.registered,
    this.deviceToken,
    this.worker,
    this.clockedInToday = false,
    this.clockedInAt,
  });

  final bool registered;
  final String? deviceToken;
  final Worker? worker;
  final bool clockedInToday;
  final DateTime? clockedInAt;

  factory WorkerStatus.fromJson(Map<String, dynamic> json) {
    final worker = json['worker'];
    return WorkerStatus(
      registered: json['registered'] == true,
      deviceToken: json['device_token'] as String?,
      worker: worker is Map<String, dynamic> ? Worker.fromJson(worker) : null,
      clockedInToday: json['clocked_in_today'] == true,
      clockedInAt: parseServerTime(json['clocked_in_at']),
    );
  }
}

class ClockInResult {
  const ClockInResult({
    required this.alreadyClockedIn,
    required this.clockInDate,
    required this.clockedInAt,
    required this.worker,
  });

  final bool alreadyClockedIn;
  final String clockInDate;
  final DateTime? clockedInAt;
  final Worker? worker;

  factory ClockInResult.fromJson(Map<String, dynamic> json) {
    final worker = json['worker'];
    return ClockInResult(
      alreadyClockedIn: json['already_clocked_in'] == true,
      clockInDate: json['clock_in_date'] as String? ?? '',
      clockedInAt: parseServerTime(json['clocked_in_at']),
      worker: worker is Map<String, dynamic> ? Worker.fromJson(worker) : null,
    );
  }
}
