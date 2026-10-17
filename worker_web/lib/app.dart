import 'package:flutter/material.dart';

import 'app_controller.dart';
import 'screens/bootstrap_screen.dart';
import 'screens/clock_in_screen.dart';
import 'screens/setup_screen.dart';
import 'screens/success_screen.dart';
import 'theme.dart';

class WorkerApp extends StatefulWidget {
  const WorkerApp({super.key, required this.controller});

  final AppController controller;

  @override
  State<WorkerApp> createState() => _WorkerAppState();
}

class _WorkerAppState extends State<WorkerApp> {
  @override
  void initState() {
    super.initState();
    widget.controller.bootstrap();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TOBC Clock-In',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      themeMode: ThemeMode.light,
      home: ListenableBuilder(
        listenable: widget.controller,
        builder: (context, _) => _screenFor(widget.controller),
      ),
    );
  }

  Widget _screenFor(AppController controller) {
    switch (controller.stage) {
      case AppStage.loading:
      case AppStage.unreachable:
        return BootstrapScreen(controller: controller);
      case AppStage.setup:
        return SetupScreen(controller: controller);
      case AppStage.clockIn:
        return ClockInScreen(controller: controller);
      case AppStage.success:
        return SuccessScreen(controller: controller);
    }
  }
}
