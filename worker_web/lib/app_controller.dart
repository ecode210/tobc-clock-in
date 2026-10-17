import 'package:flutter/foundation.dart';

import 'api/models.dart';
import 'api/token_store.dart';
import 'api/worker_api.dart';

enum AppStage { loading, unreachable, setup, clockIn, success }

class AppError {
  const AppError(this.message, {this.retryable = false});

  final String message;

  /// True when the server could not be reached and the action can be retried.
  final bool retryable;
}

const unreachableMessage =
    "Can't reach the clock-in server. Make sure you're connected to the "
    'church Wi-Fi, then try again.';

class AppController extends ChangeNotifier {
  AppController({required this.api, required this.tokenStore});

  final WorkerApi api;
  final TokenStore tokenStore;

  AppStage stage = AppStage.loading;
  Worker? worker;
  DateTime? clockedInAt;
  bool alreadyClockedIn = false;
  bool busy = false;
  AppError? error;

  /// Informational message shown on the setup screen (e.g. after a reset).
  String? setupNotice;

  void _set(void Function() update) {
    update();
    notifyListeners();
  }

  void dismissError() => _set(() => error = null);

  Future<void> bootstrap() async {
    _set(() {
      stage = AppStage.loading;
      error = null;
    });
    try {
      final status = await api.status();
      await _applyStatus(status);
    } on NetworkException {
      _set(() {
        stage = AppStage.unreachable;
        error = const AppError(unreachableMessage, retryable: true);
      });
    } on ApiException catch (e) {
      _set(() {
        stage = AppStage.unreachable;
        error = AppError(e.message, retryable: true);
      });
    }
  }

  Future<void> register(String username, String setupCode) async {
    if (busy) return;
    _set(() {
      busy = true;
      error = null;
    });
    try {
      final status = await api.register(
        username: username.trim(),
        setupCode: setupCode.trim().toUpperCase(),
      );
      if (!status.registered) {
        _set(() {
          busy = false;
          error = const AppError('Registration did not complete. Try again.');
        });
        return;
      }
      setupNotice = null;
      busy = false;
      await _applyStatus(status);
    } on NetworkException {
      _set(() {
        busy = false;
        error = const AppError(unreachableMessage, retryable: true);
      });
    } on ApiException catch (e) {
      _set(() {
        busy = false;
        error = AppError(e.message);
      });
    }
  }

  Future<void> clockIn() async {
    if (busy) return;
    _set(() {
      busy = true;
      error = null;
    });
    try {
      final result = await api.clockIn();
      _set(() {
        busy = false;
        worker = result.worker ?? worker;
        clockedInAt = result.clockedInAt;
        alreadyClockedIn = result.alreadyClockedIn;
        stage = AppStage.success;
      });
    } on NetworkException {
      _set(() {
        busy = false;
        error = const AppError(unreachableMessage, retryable: true);
      });
    } on ApiException catch (e) {
      if (e.statusCode == 401) {
        await tokenStore.clear();
        _set(() {
          busy = false;
          worker = null;
          stage = AppStage.setup;
          setupNotice =
              'This phone needs to be set up again. Enter your username and '
              'setup code.';
          error = AppError(e.message);
        });
        return;
      }
      _set(() {
        busy = false;
        error = AppError(e.message);
      });
    }
  }

  Future<void> _applyStatus(WorkerStatus status) async {
    if (!status.registered) {
      _set(() {
        worker = null;
        stage = AppStage.setup;
      });
      return;
    }
    final token = status.deviceToken;
    if (token != null && token.isNotEmpty) {
      await tokenStore.write(token);
    }
    _set(() {
      error = null;
      worker = status.worker;
      if (status.clockedInToday) {
        clockedInAt = status.clockedInAt;
        alreadyClockedIn = true;
        stage = AppStage.success;
      } else {
        stage = AppStage.clockIn;
      }
    });
  }
}
