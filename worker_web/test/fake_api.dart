import 'dart:async';

import 'package:worker_web/api/models.dart';
import 'package:worker_web/api/worker_api.dart';

const testWorker = Worker(
  id: '7',
  name: 'Ada Lovelace',
  department: 'Ushering',
  username: 'ada.lovelace',
);

/// Scriptable [WorkerApi]: each handler returns a value or throws.
class FakeWorkerApi implements WorkerApi {
  FutureOr<WorkerStatus> Function()? onStatus;
  FutureOr<WorkerStatus> Function(String username, String setupCode)?
  onRegister;
  FutureOr<ClockInResult> Function()? onClockIn;

  int statusCalls = 0;
  int registerCalls = 0;
  int clockInCalls = 0;
  String? lastUsername;
  String? lastSetupCode;

  @override
  Future<WorkerStatus> status() async {
    statusCalls++;
    return onStatus!();
  }

  @override
  Future<WorkerStatus> register({
    required String username,
    required String setupCode,
  }) async {
    registerCalls++;
    lastUsername = username;
    lastSetupCode = setupCode;
    return onRegister!(username, setupCode);
  }

  @override
  Future<ClockInResult> clockIn() async {
    clockInCalls++;
    return onClockIn!();
  }
}
