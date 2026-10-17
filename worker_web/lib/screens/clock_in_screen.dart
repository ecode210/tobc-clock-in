import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets/big_button.dart';
import '../widgets/brand_scaffold.dart';
import '../widgets/error_banner.dart';

class ClockInScreen extends StatelessWidget {
  const ClockInScreen({super.key, required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final worker = controller.worker;
    final error = controller.error;
    final name = worker?.name.isNotEmpty == true ? worker!.name : 'Worker';

    return BrandScaffold(
      action: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (error != null) ...[
            ErrorBanner(message: error.message),
            const SizedBox(height: 12),
          ],
          BigButton(
            key: const Key('clock-in-button'),
            label: error?.retryable == true ? 'Try again' : 'Clock in',
            busy: controller.busy,
            height: 64,
            fontSize: 20,
            onPressed: controller.clockIn,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            formatDay(DateTime.now()),
            key: const Key('today-date'),
            style: textTheme.titleMedium?.copyWith(color: Brand.primary),
          ),
          const SizedBox(height: 4),
          Text(
            name,
            key: const Key('worker-name'),
            style: textTheme.headlineMedium,
          ),
          if (worker != null && worker.department.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              worker.department,
              key: const Key('worker-department'),
              style: textTheme.bodyLarge?.copyWith(color: Brand.muted),
            ),
          ],
          const SizedBox(height: 24),
          const Divider(height: 1, color: Brand.outline),
          const SizedBox(height: 16),
          Row(
            children: [
              const Icon(Icons.schedule_rounded, size: 20, color: Brand.muted),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Not clocked in yet today',
                  style: textTheme.bodyLarge?.copyWith(color: Brand.muted),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
