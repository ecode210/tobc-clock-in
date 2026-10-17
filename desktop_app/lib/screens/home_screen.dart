import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../app_state.dart';
import '../server_controller.dart';
import '../theme.dart';
import '../widgets.dart';
import 'qr_screen.dart';
import 'setup_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.app});

  final AppState app;

  Future<void> _toggle(BuildContext context, bool on) async {
    if (on) {
      await app.startServer();
      return;
    }
    final ok = await confirm(
      context,
      title: 'Turn off the server?',
      subtitle: 'Workers will not be able to clock in until it is on again.',
      confirmLabel: 'Turn off',
    );
    if (ok) await app.stopServer();
  }

  void _openSettings(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => SetupScreen(app: app)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: app,
      builder: (context, _) {
        final server = app.server;
        return Scaffold(
          body: SafeArea(
            child: LayoutBuilder(
              builder: (context, box) {
                final wide = box.maxWidth >= 880;
                return SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(28, 20, 28, 28),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 1100),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _Header(
                            onSettings: server.isBusy ? null : () => _openSettings(context),
                            onLogs: () => _showLogs(context, server),
                          ),
                          const SizedBox(height: 20),
                          _PowerCard(
                            server: server,
                            onToggle: (v) => _toggle(context, v),
                          ),
                          const SizedBox(height: 20),
                          if (server.isRunning)
                            wide
                                ? Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Expanded(flex: 5, child: _AddressCard(app: app)),
                                      const SizedBox(width: 20),
                                      Expanded(
                                        flex: 6,
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.stretch,
                                          children: [
                                            _TodayCard(summary: server.summary),
                                            const SizedBox(height: 20),
                                            _SyncCard(server: server),
                                          ],
                                        ),
                                      ),
                                    ],
                                  )
                                : Column(
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    children: [
                                      _AddressCard(app: app),
                                      const SizedBox(height: 20),
                                      _TodayCard(summary: server.summary),
                                      const SizedBox(height: 20),
                                      _SyncCard(server: server),
                                    ],
                                  )
                          else
                            const _StepsCard(),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onSettings, required this.onLogs});

  final VoidCallback? onSettings;
  final VoidCallback onLogs;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SvgPicture.asset('assets/images/logo.svg', height: 40),
        const Spacer(),
        TextButton.icon(
          onPressed: onLogs,
          icon: const Icon(Icons.receipt_long_rounded, size: 20),
          label: const Text('Activity log'),
        ),
        const SizedBox(width: 4),
        TextButton.icon(
          onPressed: onSettings,
          icon: const Icon(Icons.settings_rounded, size: 20),
          label: const Text('Settings'),
        ),
      ],
    );
  }
}

class _PowerCard extends StatelessWidget {
  const _PowerCard({required this.server, required this.onToggle});

  final ServerController server;
  final ValueChanged<bool> onToggle;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final (title, subtitle) = switch (server.state) {
      ServerState.running => ('Server is on', 'Workers can clock in now. Keep this laptop awake and on the church Wi-Fi.'),
      ServerState.starting => ('Turning on', 'Starting the clock-in server.'),
      ServerState.stopping => ('Turning off', 'Saving everything and stopping the server.'),
      ServerState.stopped || ServerState.failed => ('Server is off', 'Turn it on before service so workers can clock in.'),
    };
    final on = server.isRunning;

    return BrandCard(
      padding: const EdgeInsets.fromLTRB(28, 24, 28, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: on
                      ? const LinearGradient(
                          colors: [Brand.primary, Brand.secondary],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : null,
                  color: on ? null : Brand.field,
                ),
                child: Icon(
                  Icons.power_settings_new_rounded,
                  size: 32,
                  color: on ? Colors.white : Brand.muted,
                ),
              ),
              const SizedBox(width: 20),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: t.headlineMedium),
                    const SizedBox(height: 2),
                    Text(subtitle, style: t.bodyLarge?.copyWith(color: Brand.muted)),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              SizedBox(
                width: 96,
                height: 56,
                child: Center(
                  child: server.isBusy
                      ? const SizedBox(
                          width: 32,
                          height: 32,
                          child: CircularProgressIndicator(strokeWidth: 3),
                        )
                      : Transform.scale(
                          scale: 1.5,
                          child: Switch(
                            value: on,
                            onChanged: onToggle,
                          ),
                        ),
                ),
              ),
            ],
          ),
          if (server.state == ServerState.failed && server.error != null) ...[
            const SizedBox(height: 18),
            Notice(message: server.error!),
          ],
        ],
      ),
    );
  }
}

class _AddressCard extends StatelessWidget {
  const _AddressCard({required this.app});

  final AppState app;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final url = app.workerUrl;

    return BrandCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SectionTitle(
            'Open on worker phones',
            subtitle: 'Scan the code or type the address. Phones must be on the same Wi-Fi.',
          ),
          const SizedBox(height: 20),
          if (url == null)
            const Notice(
              tone: NoticeTone.warning,
              message: 'This laptop is not on a network. Connect it to the church Wi-Fi.',
            )
          else ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(width: 56),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Brand.outline, width: 1.5),
                  ),
                  child: QrImageView(
                    data: url,
                    size: 200,
                    padding: EdgeInsets.zero,
                    eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: Brand.ink),
                    dataModuleStyle: const QrDataModuleStyle(
                      dataModuleShape: QrDataModuleShape.square,
                      color: Brand.ink,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filledTonal(
                  tooltip: 'Show full screen',
                  style: IconButton.styleFrom(
                    backgroundColor: Brand.primarySoft,
                    foregroundColor: Brand.primary,
                  ),
                  icon: const Icon(Icons.fullscreen_rounded),
                  onPressed: () => showQrFullScreen(context, url),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.fromLTRB(22, 6, 6, 6),
              decoration: BoxDecoration(
                color: Brand.primarySoft,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: SelectableText(
                      url,
                      maxLines: 1,
                      style: t.titleLarge?.copyWith(color: Brand.primary, fontWeight: FontWeight.w700),
                    ),
                  ),
                  IconButton.filled(
                    tooltip: 'Copy address',
                    style: IconButton.styleFrom(backgroundColor: Brand.primary),
                    icon: const Icon(Icons.copy_rounded, size: 20),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: url));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Address copied.')),
                      );
                    },
                  ),
                ],
              ),
            ),
            if (app.addresses.length > 1) ...[
              const SizedBox(height: 10),
              Center(
                child: PopupMenuButton<String>(
                  tooltip: 'Choose network',
                  onSelected: app.selectIp,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                  itemBuilder: (_) => [
                    for (final a in app.addresses)
                      PopupMenuItem(
                        value: a.ip,
                        child: Text('${a.ip}  (${a.interfaceName})'),
                      ),
                  ],
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Text(
                      'Phones cannot open it? Try another network',
                      style: t.bodyMedium?.copyWith(color: Brand.primary, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _TodayCard extends StatelessWidget {
  const _TodayCard({required this.summary});

  final ServerSummary? summary;

  @override
  Widget build(BuildContext context) {
    final s = summary;
    return BrandCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SectionTitle('Today', subtitle: 'Live numbers from this laptop.'),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: StatTile(
                  label: 'Clocked in',
                  value: s == null ? '-' : '${s.clockedInToday}',
                  hint: s == null ? null : 'of ${s.workers}',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: StatTile(
                  label: 'Devices locked',
                  value: s == null ? '-' : '${s.devicesLocked}',
                  hint: s == null ? null : 'of ${s.workers}',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: StatTile(
                  label: 'Waiting to sync',
                  value: s == null ? '-' : '${s.pendingClockIns}',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SyncCard extends StatelessWidget {
  const _SyncCard({required this.server});

  final ServerController server;

  Future<void> _syncNow(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final message = await server.syncNow();
    if (message.isNotEmpty) {
      messenger.showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final sync = server.sync;
    final online = sync?.online ?? false;
    final last = sync?.lastSuccessAt;

    return BrandCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SectionTitle(
            'Cloud sync',
            subtitle: 'Syncs every minute when the internet is on.',
            trailing: online
                ? const StatusPill(label: 'Online', color: Brand.success, background: Brand.successSoft)
                : const StatusPill(label: 'Offline', color: Brand.warning, background: Brand.warningSoft),
          ),
          const SizedBox(height: 16),
          Text(
            last == null ? 'Not synced yet.' : 'Last synced ${timeAgo(last)}.',
            style: t.bodyLarge,
          ),
          if (!online) ...[
            const SizedBox(height: 4),
            Text(
              'Clock-ins are saved on this laptop and sync when the internet is back.',
              style: t.bodyMedium?.copyWith(color: Brand.muted),
            ),
          ],
          if (sync?.lastError != null) ...[
            const SizedBox(height: 12),
            Notice(tone: NoticeTone.warning, message: 'Last sync problem: ${sync!.lastError}'),
          ],
          const SizedBox(height: 18),
          Align(
            alignment: Alignment.centerLeft,
            child: FilledButton.icon(
              onPressed: server.syncing ? null : () => _syncNow(context),
              icon: server.syncing
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    )
                  : const Icon(Icons.sync_rounded, size: 20),
              label: Text(server.syncing ? 'Syncing' : 'Sync now'),
            ),
          ),
        ],
      ),
    );
  }
}

class _StepsCard extends StatelessWidget {
  const _StepsCard();

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    const steps = [
      'Connect this laptop to the church Wi-Fi.',
      'Turn on the server with the switch above.',
      'Workers scan the QR code with their phone to clock in.',
      'After service, turn the server off and close the app.',
    ];
    return BrandCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SectionTitle('How it works', subtitle: 'Four steps every service.'),
          const SizedBox(height: 18),
          for (var i = 0; i < steps.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(color: Brand.primarySoft, shape: BoxShape.circle),
                    child: Text(
                      '${i + 1}',
                      style: const TextStyle(color: Brand.primary, fontWeight: FontWeight.w900),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(child: Text(steps[i], style: t.bodyLarge)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

Future<void> _showLogs(BuildContext context, ServerController server) {
  return showBrandDialog<void>(
    context: context,
    title: 'Activity log',
    subtitle: 'Recent messages from the server.',
    maxWidth: 760,
    builder: (ctx) => ListenableBuilder(
      listenable: server,
      builder: (ctx, _) {
        final logs = server.logs;
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              height: 380,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Brand.field,
                borderRadius: BorderRadius.circular(20),
              ),
              child: logs.isEmpty
                  ? Center(
                      child: Text('Nothing yet.', style: TextStyle(color: Brand.muted)),
                    )
                  : SingleChildScrollView(
                      reverse: true,
                      child: SelectableText(
                        logs.join('\n'),
                        style: const TextStyle(fontFamily: 'Menlo', fontFamilyFallback: ['Consolas', 'monospace'], fontSize: 12, height: 1.5),
                      ),
                    ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: logs.isEmpty
                        ? null
                        : () {
                            Clipboard.setData(ClipboardData(text: logs.join('\n')));
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Log copied.')),
                            );
                          },
                    child: const Text('Copy log'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Close'),
                  ),
                ),
              ],
            ),
          ],
        );
      },
    ),
  );
}

String timeAgo(DateTime at) {
  final diff = DateTime.now().difference(at);
  if (diff.inSeconds < 45) return 'just now';
  if (diff.inMinutes < 60) {
    final m = diff.inMinutes < 1 ? 1 : diff.inMinutes;
    return '$m ${m == 1 ? 'minute' : 'minutes'} ago';
  }
  if (diff.inHours < 24) {
    return '${diff.inHours} ${diff.inHours == 1 ? 'hour' : 'hours'} ago';
  }
  final d = diff.inDays;
  return '$d ${d == 1 ? 'day' : 'days'} ago';
}
