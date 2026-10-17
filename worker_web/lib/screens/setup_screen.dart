import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app_controller.dart';
import '../theme.dart';
import '../widgets/big_button.dart';
import '../widgets/brand_scaffold.dart';
import '../widgets/error_banner.dart';

const setupCodeLength = 6;
const welcomeTitle = 'Welcome to TOBC\nClock-In System!';

class UpperCaseTextFormatter extends TextInputFormatter {
  const UpperCaseTextFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) => newValue.copyWith(text: newValue.text.toUpperCase());
}

class SetupScreen extends StatefulWidget {
  const SetupScreen({super.key, required this.controller});

  final AppController controller;

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  final _username = TextEditingController();
  final _code = TextEditingController();

  @override
  void initState() {
    super.initState();
    _username.addListener(_onChanged);
    _code.addListener(_onChanged);
  }

  @override
  void dispose() {
    _username.dispose();
    _code.dispose();
    super.dispose();
  }

  void _onChanged() => setState(() {});

  bool get _canSubmit =>
      _username.text.trim().isNotEmpty &&
      _code.text.trim().length == setupCodeLength;

  void _submit() {
    if (!_canSubmit) return;
    FocusScope.of(context).unfocus();
    widget.controller.register(_username.text, _code.text);
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final textTheme = Theme.of(context).textTheme;
    final error = controller.error;
    final enabled = !controller.busy;

    return BrandScaffold(
      centerBody: true,
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              welcomeTitle,
              textAlign: TextAlign.center,
              style: textTheme.headlineMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'Enter your username and code to setup your account.',
              textAlign: TextAlign.center,
              style: textTheme.bodyLarge?.copyWith(color: Brand.muted),
            ),
            if (controller.setupNotice != null) ...[
              const SizedBox(height: 16),
              _Notice(message: controller.setupNotice!),
            ],
            const SizedBox(height: 28),
            const _FieldLabel('Username'),
            TextField(
              key: const Key('username-field'),
              controller: _username,
              enabled: enabled,
              autocorrect: false,
              enableSuggestions: false,
              textCapitalization: TextCapitalization.none,
              textInputAction: TextInputAction.next,
              keyboardType: TextInputType.text,
              autofillHints: const [AutofillHints.username],
              style: const TextStyle(fontSize: 18),
              decoration: const InputDecoration(hintText: 'e.g. john.doe'),
            ),
            const SizedBox(height: 20),
            const _FieldLabel('Setup code'),
            TextField(
              key: const Key('setup-code-field'),
              controller: _code,
              enabled: enabled,
              autocorrect: false,
              enableSuggestions: false,
              maxLength: setupCodeLength,
              keyboardType: TextInputType.text,
              textCapitalization: TextCapitalization.characters,
              textInputAction: TextInputAction.done,
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp('[A-Za-z0-9]')),
                const UpperCaseTextFormatter(),
              ],
              onSubmitted: (_) => _submit(),
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w600,
                letterSpacing: 6,
              ),
              decoration: const InputDecoration(
                hintText: '6 characters',
                hintStyle: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w400,
                  letterSpacing: 0,
                  color: Color(0xFF9A95A3),
                ),
                counterText: '',
              ),
            ),
            if (error != null) ...[
              const SizedBox(height: 20),
              ErrorBanner(message: error.message),
            ],
            const SizedBox(height: 28),
            BigButton(
              key: const Key('register-button'),
              label: error?.retryable == true ? 'Try again' : 'Setup Device',
              busy: controller.busy,
              onPressed: _canSubmit ? _submit : null,
            ),
          ],
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text, style: Theme.of(context).textTheme.titleMedium),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: Brand.field,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 1),
            child: Icon(
              Icons.info_outline_rounded,
              size: 20,
              color: Brand.muted,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(fontSize: 16, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}
