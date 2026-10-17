import 'package:flutter/material.dart';

import 'theme.dart';

class BrandCard extends StatelessWidget {
  const BrandCard({super.key, required this.child, this.padding = const EdgeInsets.all(24)});

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Brand.surface,
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [
          BoxShadow(color: Color(0x0F16131C), blurRadius: 24, offset: Offset(0, 8)),
        ],
      ),
      child: Material(
        type: MaterialType.transparency,
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.subtitle, this.trailing});

  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: t.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(subtitle!, style: t.bodyMedium?.copyWith(color: Brand.muted)),
              ],
            ],
          ),
        ),
        ?trailing,
      ],
    );
  }
}

/// A dialog with the brand header: a title and a short subtitle.
Future<T?> showBrandDialog<T>({
  required BuildContext context,
  required String title,
  required String subtitle,
  required Widget Function(BuildContext context) builder,
  double maxWidth = 440,
  bool dismissible = true,
}) {
  return showDialog<T>(
    context: context,
    barrierDismissible: dismissible,
    barrierColor: const Color(0x6616131C),
    builder: (ctx) {
      final t = Theme.of(ctx).textTheme;
      return Dialog(
        insetPadding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(28, 26, 28, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(title, style: t.titleLarge),
                const SizedBox(height: 4),
                Text(subtitle, style: t.bodyMedium?.copyWith(color: Brand.muted)),
                const SizedBox(height: 20),
                Flexible(child: builder(ctx)),
              ],
            ),
          ),
        ),
      );
    },
  );
}

/// Yes or no question in a brand dialog. Resolves to true when confirmed.
Future<bool> confirm(
  BuildContext context, {
  required String title,
  required String subtitle,
  required String confirmLabel,
  String cancelLabel = 'Cancel',
}) async {
  final ok = await showBrandDialog<bool>(
    context: context,
    title: title,
    subtitle: subtitle,
    builder: (ctx) => Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(cancelLabel),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(confirmLabel),
          ),
        ),
      ],
    ),
  );
  return ok ?? false;
}

class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.label, required this.value, this.hint});

  final String label;
  final String value;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      decoration: BoxDecoration(
        color: Brand.field,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: t.bodyMedium?.copyWith(color: Brand.muted)),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                value,
                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, height: 1),
              ),
              if (hint != null) ...[
                const SizedBox(width: 6),
                Text(hint!, style: t.bodyMedium?.copyWith(color: Brand.muted)),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.label, required this.color, required this.background});

  final String label;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 7),
          Text(
            label,
            style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class Notice extends StatelessWidget {
  const Notice({super.key, required this.message, this.tone = NoticeTone.error});

  final String message;
  final NoticeTone tone;

  @override
  Widget build(BuildContext context) {
    final (fg, bg, icon) = switch (tone) {
      NoticeTone.error => (Brand.danger, Brand.dangerSoft, Icons.error_outline_rounded),
      NoticeTone.warning => (Brand.warning, Brand.warningSoft, Icons.info_outline_rounded),
      NoticeTone.success => (Brand.success, Brand.successSoft, Icons.check_circle_outline_rounded),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: fg, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(message, style: TextStyle(color: fg, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

enum NoticeTone { error, warning, success }
