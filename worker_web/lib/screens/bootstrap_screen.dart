import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../theme.dart';
import '../widgets/big_button.dart';
import '../widgets/brand_scaffold.dart';

/// Shown while the first status call runs, and when the server is unreachable.
class BootstrapScreen extends StatelessWidget {
  const BootstrapScreen({super.key, required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.stage != AppStage.unreachable) {
      return const BrandScaffold(centerBody: true, child: _Loading());
    }
    return BrandScaffold(
      centerBody: true,
      action: BigButton(
        key: const Key('retry-button'),
        label: 'Try again',
        onPressed: controller.bootstrap,
      ),
      child: _Unreachable(
        message: controller.error?.message ?? unreachableMessage,
      ),
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(
          width: 32,
          height: 32,
          child: CircularProgressIndicator(strokeWidth: 3),
        ),
        const SizedBox(height: 16),
        Text(
          'Checking this phone…',
          style: Theme.of(
            context,
          ).textTheme.bodyLarge?.copyWith(color: Brand.muted),
        ),
      ],
    );
  }
}

class _Unreachable extends StatelessWidget {
  const _Unreachable({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.wifi_off_rounded, size: 40, color: Brand.muted),
        const SizedBox(height: 16),
        Text(
          'Not connected',
          textAlign: TextAlign.center,
          style: textTheme.headlineMedium,
        ),
        const SizedBox(height: 8),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 320),
          child: Text(
            message,
            textAlign: TextAlign.center,
            style: textTheme.bodyLarge?.copyWith(color: Brand.muted),
          ),
        ),
      ],
    );
  }
}
