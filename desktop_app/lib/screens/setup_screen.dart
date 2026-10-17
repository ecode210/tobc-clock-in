import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../app_state.dart';
import '../network.dart';
import '../settings.dart';
import '../theme.dart';
import '../widgets.dart';

/// Links this laptop to the cloud admin. Shown on first launch and from Settings.
class SetupScreen extends StatefulWidget {
  const SetupScreen({super.key, required this.app, this.firstRun = false});

  final AppState app;
  final bool firstRun;

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  late final _url = TextEditingController(text: widget.app.settings.cloudUrl);
  late final _token = TextEditingController(text: widget.app.settings.syncToken);
  late final _port = TextEditingController(text: '${widget.app.settings.port}');
  late bool _startOnLaunch = widget.app.settings.startOnLaunch;

  bool _showToken = false;
  bool _checking = false;
  bool _saving = false;
  CloudCheckResult? _result;
  String? _formError;

  @override
  void dispose() {
    _url.dispose();
    _token.dispose();
    _port.dispose();
    super.dispose();
  }

  String? _validate() {
    if (normalizeCloudUrl(_url.text).isEmpty) return 'Enter the cloud admin address.';
    if (_token.text.trim().isEmpty) return 'Enter the sync token.';
    final port = int.tryParse(_port.text.trim());
    if (port == null || port < 1 || port > 65535) return 'Port must be a number from 1 to 65535.';
    return null;
  }

  Future<CloudCheckResult?> _test() async {
    final error = _validate();
    setState(() {
      _formError = error;
      _result = null;
    });
    if (error != null) return null;
    setState(() => _checking = true);
    final res = await checkCloud(normalizeCloudUrl(_url.text), _token.text.trim());
    if (!mounted) return null;
    setState(() {
      _checking = false;
      _result = res;
    });
    return res;
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final res = await _test();
      if (res == null || !mounted) return;
      if (res.status == CloudCheck.badToken || res.status == CloudCheck.notFound) return;
      if (res.status != CloudCheck.ok) {
        final saveAnyway = await confirm(
          context,
          title: 'Save without checking?',
          subtitle: 'The cloud admin could not be reached. Save now and it will sync once the internet is back.',
          confirmLabel: 'Save anyway',
        );
        if (!saveAnyway || !mounted) return;
      }
      final messenger = ScaffoldMessenger.of(context);
      final navigator = Navigator.of(context);
      await widget.app.saveSettings(
        widget.app.settings.copyWith(
          cloudUrl: normalizeCloudUrl(_url.text),
          syncToken: _token.text.trim(),
          port: int.parse(_port.text.trim()),
          startOnLaunch: _startOnLaunch,
        ),
      );
      if (!widget.firstRun) {
        navigator.pop();
        messenger.showSnackBar(const SnackBar(content: Text('Settings saved.')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget? _resultNotice() {
    final r = _result;
    if (_formError != null) return Notice(message: _formError!);
    if (r == null) return null;
    return switch (r.status) {
      CloudCheck.ok => Notice(
        tone: NoticeTone.success,
        message: 'Connected. The cloud admin has ${r.workers} ${r.workers == 1 ? 'worker' : 'workers'}.',
      ),
      CloudCheck.badToken => const Notice(
        message: 'The sync token is wrong. Copy it again from the cloud admin server settings.',
      ),
      CloudCheck.notFound => const Notice(
        message: 'That address is not a TOBC cloud admin. Check the address and try again.',
      ),
      CloudCheck.unreachable => const Notice(
        tone: NoticeTone.warning,
        message: 'Could not reach the cloud admin. Check the address and the internet connection.',
      ),
      CloudCheck.error => Notice(message: r.detail ?? 'Something went wrong. Try again.'),
    };
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final busy = _checking || _saving;
    final notice = _resultNotice();

    final form = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.firstRun) ...[
          Center(child: SvgPicture.asset('assets/images/logo.svg', height: 64)),
          const SizedBox(height: 28),
        ],
        Text(
          widget.firstRun ? 'Set up this laptop' : 'Settings',
          style: t.headlineMedium,
          textAlign: widget.firstRun ? TextAlign.center : TextAlign.start,
        ),
        const SizedBox(height: 6),
        Text(
          'Paste the cloud admin address and sync token to link this laptop.',
          style: t.bodyLarge?.copyWith(color: Brand.muted),
          textAlign: widget.firstRun ? TextAlign.center : TextAlign.start,
        ),
        const SizedBox(height: 28),
        const _Label('Cloud admin address'),
        TextField(
          controller: _url,
          enabled: !busy,
          keyboardType: TextInputType.url,
          autocorrect: false,
          decoration: const InputDecoration(hintText: 'https://admin.example.org'),
          onChanged: (_) => setState(() => _result = null),
        ),
        const SizedBox(height: 18),
        const _Label('Sync token'),
        TextField(
          controller: _token,
          enabled: !busy,
          obscureText: !_showToken,
          autocorrect: false,
          enableSuggestions: false,
          decoration: InputDecoration(
            hintText: 'The SYNC_TOKEN from the cloud admin',
            suffixIcon: Padding(
              padding: const EdgeInsets.only(right: 8),
              child: IconButton(
                tooltip: _showToken ? 'Hide token' : 'Show token',
                icon: Icon(_showToken ? Icons.visibility_off_rounded : Icons.visibility_rounded),
                onPressed: () => setState(() => _showToken = !_showToken),
              ),
            ),
          ),
          onChanged: (_) => setState(() => _result = null),
        ),
        const SizedBox(height: 18),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            SizedBox(
              width: 150,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _Label('Port'),
                  TextField(
                    controller: _port,
                    enabled: !busy,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(5),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Text(
                  'Leave as $defaultPort unless another program uses it.',
                  style: t.bodyMedium?.copyWith(color: Brand.muted),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        SwitchListTile(
          contentPadding: const EdgeInsets.only(left: 4),
          value: _startOnLaunch,
          onChanged: busy ? null : (v) => setState(() => _startOnLaunch = v),
          title: const Text('Turn on the server when the app opens'),
        ),
        if (notice != null) ...[const SizedBox(height: 12), notice],
        const SizedBox(height: 24),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: busy ? null : _test,
                child: _checking && !_saving
                    ? const _Spinner(color: Brand.ink)
                    : const Text('Test connection'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                onPressed: busy ? null : _save,
                child: _saving
                    ? const _Spinner(color: Brand.primary)
                    : Text(widget.firstRun ? 'Save and continue' : 'Save'),
              ),
            ),
          ],
        ),
        if (!widget.firstRun) ...[
          const SizedBox(height: 24),
          SelectableText(
            'Data folder: ${widget.app.dataFolder}',
            style: t.bodySmall?.copyWith(color: Brand.muted),
          ),
        ],
      ],
    );

    return Scaffold(
      appBar: widget.firstRun
          ? null
          : AppBar(
              backgroundColor: Brand.canvas,
              surfaceTintColor: Colors.transparent,
              leading: IconButton(
                tooltip: 'Back',
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: busy ? null : () => Navigator.of(context).pop(),
              ),
            ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: BrandCard(padding: const EdgeInsets.all(32), child: form),
          ),
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(left: 6, bottom: 8),
    child: Text(text, style: const TextStyle(fontWeight: FontWeight.w600)),
  );
}

class _Spinner extends StatelessWidget {
  const _Spinner({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 20,
    height: 20,
    child: CircularProgressIndicator(strokeWidth: 2.5, color: color),
  );
}
