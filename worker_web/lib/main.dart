import 'package:flutter/material.dart';

import 'api/token_store.dart';
import 'api/worker_api.dart';
import 'app.dart';
import 'app_controller.dart';

void main() {
  final tokenStore = SharedPrefsTokenStore();
  final api = HttpWorkerApi(baseUri: resolveApiBase(), tokenStore: tokenStore);
  runApp(
    WorkerApp(
      controller: AppController(api: api, tokenStore: tokenStore),
    ),
  );
}
