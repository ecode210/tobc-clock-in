import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../format.dart';
import '../theme.dart';
import '../widgets/brand_scaffold.dart';

class SuccessScreen extends StatelessWidget {
  const SuccessScreen({super.key, required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final worker = controller.worker;
    final time = controller.clockedInAt;

    return BrandScaffold(
      centerBody: true,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              key: const Key('success-check'),
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Brand.primary.withValues(alpha: 0.1),
              ),
              child: const Icon(
                Icons.check_rounded,
                color: Brand.primary,
                size: 44,
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            "You're clocked in",
            textAlign: TextAlign.center,
            style: textTheme.headlineMedium,
          ),
          if (time != null) ...[
            const SizedBox(height: 6),
            Text(
              formatClockTime(time),
              key: const Key('success-time'),
              textAlign: TextAlign.center,
              style: textTheme.titleMedium,
            ),
          ],
          if (controller.alreadyClockedIn) ...[
            const SizedBox(height: 4),
            Text(
              'Already clocked in today',
              textAlign: TextAlign.center,
              style: textTheme.bodyMedium?.copyWith(color: Brand.muted),
            ),
          ],
          if (worker != null) ...[
            const SizedBox(height: 28),
            _WorkerRow(name: worker.name, department: worker.department),
          ],
          const SizedBox(height: 28),
          Text(
            'God bless you. You can close this page.',
            textAlign: TextAlign.center,
            style: textTheme.bodyMedium?.copyWith(color: Brand.muted),
          ),
        ],
      ),
    );
  }
}

class _WorkerRow extends StatelessWidget {
  const _WorkerRow({required this.name, required this.department});

  final String name;
  final String department;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Brand.field,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        children: [
          Text(
            name,
            key: const Key('success-name'),
            textAlign: TextAlign.center,
            style: textTheme.titleMedium?.copyWith(fontSize: 20),
          ),
          if (department.isNotEmpty)
            Text(
              department,
              key: const Key('success-department'),
              textAlign: TextAlign.center,
              style: textTheme.bodyLarge?.copyWith(color: Brand.muted),
            ),
        ],
      ),
    );
  }
}
