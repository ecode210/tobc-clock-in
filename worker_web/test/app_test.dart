import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_web/api/models.dart';
import 'package:worker_web/api/token_store.dart';
import 'package:worker_web/api/worker_api.dart';
import 'package:worker_web/app.dart';
import 'package:worker_web/app_controller.dart';
import 'package:worker_web/format.dart';
import 'package:worker_web/screens/setup_screen.dart';
import 'package:worker_web/theme.dart';
import 'package:worker_web/widgets/brand_scaffold.dart';

import 'fake_api.dart';

WorkerStatus registered({
  String token = 'tok-1',
  bool clockedInToday = false,
  DateTime? at,
}) => WorkerStatus(
  registered: true,
  deviceToken: token,
  worker: testWorker,
  clockedInToday: clockedInToday,
  clockedInAt: at,
);

void main() {
  late FakeWorkerApi api;
  late MemoryTokenStore store;
  late AppController controller;

  setUp(() {
    api = FakeWorkerApi();
    store = MemoryTokenStore();
    controller = AppController(api: api, tokenStore: store);
  });

  Future<void> pumpApp(WidgetTester tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(WorkerApp(controller: controller));
    await tester.pumpAndSettle();
  }

  testWidgets('uses the light brand theme', (tester) async {
    api.onStatus = () => const WorkerStatus(registered: false);
    await pumpApp(tester);
    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.themeMode, ThemeMode.light);
    expect(app.darkTheme, isNull);
    expect(app.theme!.colorScheme.brightness, Brightness.light);
    expect(app.theme!.colorScheme.primary, Brand.primary);
    expect(app.theme!.colorScheme.secondary, Brand.secondary);
  });

  testWidgets('shows a spinner while status loads', (tester) async {
    api.onStatus = () => Future.delayed(
      const Duration(seconds: 1),
      () => const WorkerStatus(registered: false),
    );
    await tester.pumpWidget(WorkerApp(controller: controller));
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pumpAndSettle(const Duration(seconds: 2));
    expect(find.text(welcomeTitle), findsOneWidget);
  });

  testWidgets('unregistered device goes to setup; register saves token and '
      'shows clock-in', (tester) async {
    api.onStatus = () => const WorkerStatus(registered: false);
    api.onRegister = (_, _) => registered(token: 'new-token');
    await pumpApp(tester);

    expect(find.text(welcomeTitle), findsOneWidget);
    final button = find.byKey(const Key('register-button'));
    expect(
      tester
          .widget<FilledButton>(
            find.descendant(of: button, matching: find.byType(FilledButton)),
          )
          .onPressed,
      isNull,
    );

    await tester.enterText(
      find.byKey(const Key('username-field')),
      ' ada.lovelace ',
    );
    await tester.enterText(find.byKey(const Key('setup-code-field')), 'ab3k9z');
    await tester.pump();

    final codeField = tester.widget<TextField>(
      find.byKey(const Key('setup-code-field')),
    );
    expect(codeField.controller!.text, 'AB3K9Z');

    await tester.tap(button);
    await tester.pumpAndSettle();

    expect(api.lastUsername, 'ada.lovelace');
    expect(api.lastSetupCode, 'AB3K9Z');
    expect(store.token, 'new-token');
    expect(find.text('Ada Lovelace'), findsOneWidget);
    expect(find.text('Ushering'), findsOneWidget);
    expect(find.text('Clock in'), findsOneWidget);
  });

  testWidgets('setup code is limited to 6 alphanumeric characters', (
    tester,
  ) async {
    api.onStatus = () => const WorkerStatus(registered: false);
    await pumpApp(tester);
    await tester.enterText(
      find.byKey(const Key('setup-code-field')),
      'ab-c d1234',
    );
    await tester.pump();
    final field = tester.widget<TextField>(
      find.byKey(const Key('setup-code-field')),
    );
    expect(field.controller!.text, 'ABCD12');
  });

  testWidgets('register shows the server error message', (tester) async {
    api.onStatus = () => const WorkerStatus(registered: false);
    api.onRegister = (_, _) =>
        throw const ApiException(401, 'Invalid username or setup code');
    await pumpApp(tester);

    await tester.enterText(find.byKey(const Key('username-field')), 'ada');
    await tester.enterText(find.byKey(const Key('setup-code-field')), 'XXXXXX');
    await tester.pump();
    await tester.tap(find.byKey(const Key('register-button')));
    await tester.pumpAndSettle();

    expect(find.text('Invalid username or setup code'), findsOneWidget);
    expect(find.text('Try again'), findsNothing);
    expect(store.token, isNull);
    expect(find.text(welcomeTitle), findsOneWidget);
  });

  testWidgets('register network failure offers retry', (tester) async {
    api.onStatus = () => const WorkerStatus(registered: false);
    var fail = true;
    api.onRegister = (_, _) {
      if (fail) throw const NetworkException();
      return registered();
    };
    await pumpApp(tester);

    await tester.enterText(find.byKey(const Key('username-field')), 'ada');
    await tester.enterText(find.byKey(const Key('setup-code-field')), 'ABCDEF');
    await tester.pump();
    await tester.tap(find.byKey(const Key('register-button')));
    await tester.pumpAndSettle();

    expect(find.text(unreachableMessage), findsOneWidget);
    expect(
      find.descendant(
        of: find.byKey(const Key('register-button')),
        matching: find.text('Try again'),
      ),
      findsOneWidget,
    );
    fail = false;
    await tester.ensureVisible(find.byKey(const Key('register-button')));
    await tester.tap(find.byKey(const Key('register-button')));
    await tester.pumpAndSettle();
    expect(api.registerCalls, 2);
    expect(find.text('Clock in'), findsOneWidget);
  });

  testWidgets('status with device_token saves it (cache recovery)', (
    tester,
  ) async {
    api.onStatus = () => registered(token: 'recovered');
    await pumpApp(tester);
    expect(store.token, 'recovered');
    expect(find.text('Clock in'), findsOneWidget);
  });

  testWidgets('clock in shows confirmation with formatted time', (
    tester,
  ) async {
    api.onStatus = () => registered();
    api.onClockIn = () => ClockInResult(
      alreadyClockedIn: false,
      clockInDate: '2026-10-18',
      clockedInAt: DateTime(2026, 10, 18, 7, 14),
      worker: testWorker,
    );
    await pumpApp(tester);

    await tester.tap(find.byKey(const Key('clock-in-button')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('success-check')), findsOneWidget);
    expect(find.text("You're clocked in"), findsOneWidget);
    expect(find.text('Ada Lovelace'), findsOneWidget);
    expect(find.text('Ushering'), findsOneWidget);
    expect(find.text('Sunday, Oct 18 at 07:14 AM'), findsOneWidget);
    expect(find.text('Already clocked in today'), findsNothing);
  });

  testWidgets('clock in that was already done shows the note', (tester) async {
    api.onStatus = () => registered();
    api.onClockIn = () => ClockInResult(
      alreadyClockedIn: true,
      clockInDate: '2026-10-18',
      clockedInAt: DateTime(2026, 10, 18, 6, 50),
      worker: testWorker,
    );
    await pumpApp(tester);
    await tester.tap(find.byKey(const Key('clock-in-button')));
    await tester.pumpAndSettle();
    expect(find.text('Already clocked in today'), findsOneWidget);
    expect(find.text('Sunday, Oct 18 at 06:50 AM'), findsOneWidget);
  });

  testWidgets('already clocked in at bootstrap skips straight to '
      'confirmation', (tester) async {
    api.onStatus = () =>
        registered(clockedInToday: true, at: DateTime(2026, 10, 18, 19, 5));
    await pumpApp(tester);
    expect(find.text('Clock in'), findsNothing);
    expect(find.text("You're clocked in"), findsOneWidget);
    expect(find.text('Already clocked in today'), findsOneWidget);
    expect(find.text('Sunday, Oct 18 at 07:05 PM'), findsOneWidget);
  });

  testWidgets('clock-in 401 clears the token and returns to setup', (
    tester,
  ) async {
    store.token = 'stale';
    api.onStatus = () => registered(token: 'stale');
    api.onClockIn = () =>
        throw const ApiException(401, 'Device not registered');
    await pumpApp(tester);

    await tester.tap(find.byKey(const Key('clock-in-button')));
    await tester.pumpAndSettle();

    expect(store.token, isNull);
    expect(find.text(welcomeTitle), findsOneWidget);
    expect(find.text('Device not registered'), findsOneWidget);
  });

  testWidgets('clock-in 403 shows the server message and stays put', (
    tester,
  ) async {
    api.onStatus = () => registered();
    api.onClockIn = () => throw const ApiException(
      403,
      'This phone is registered to another worker',
    );
    await pumpApp(tester);

    await tester.tap(find.byKey(const Key('clock-in-button')));
    await tester.pumpAndSettle();

    expect(
      find.text('This phone is registered to another worker'),
      findsOneWidget,
    );
    expect(find.text('Clock in'), findsOneWidget);
    expect(store.token, 'tok-1');
  });

  testWidgets('clock-in network failure offers retry', (tester) async {
    api.onStatus = () => registered();
    var fail = true;
    api.onClockIn = () {
      if (fail) throw const NetworkException();
      return ClockInResult(
        alreadyClockedIn: false,
        clockInDate: '2026-10-18',
        clockedInAt: DateTime(2026, 10, 18, 7, 14),
        worker: testWorker,
      );
    };
    await pumpApp(tester);

    await tester.tap(find.byKey(const Key('clock-in-button')));
    await tester.pumpAndSettle();
    expect(find.text(unreachableMessage), findsOneWidget);
    expect(
      find.descendant(
        of: find.byKey(const Key('clock-in-button')),
        matching: find.text('Try again'),
      ),
      findsOneWidget,
    );

    fail = false;
    await tester.tap(find.byKey(const Key('clock-in-button')));
    await tester.pumpAndSettle();
    expect(api.clockInCalls, 2);
    expect(find.text("You're clocked in"), findsOneWidget);
  });

  testWidgets('unreachable server at bootstrap offers retry', (tester) async {
    var fail = true;
    api.onStatus = () {
      if (fail) throw const NetworkException();
      return const WorkerStatus(registered: false);
    };
    await pumpApp(tester);

    expect(find.text('Not connected'), findsOneWidget);
    expect(find.text(unreachableMessage), findsOneWidget);

    fail = false;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(api.statusCalls, 2);
    expect(find.text(welcomeTitle), findsOneWidget);
  });

  testWidgets('setup fields are configured for phone keyboards', (
    tester,
  ) async {
    api.onStatus = () => const WorkerStatus(registered: false);
    await pumpApp(tester);

    final username = tester.widget<TextField>(
      find.byKey(const Key('username-field')),
    );
    expect(username.keyboardType, TextInputType.text);
    expect(username.autocorrect, isFalse);
    expect(username.enableSuggestions, isFalse);
    expect(username.textInputAction, TextInputAction.next);
    expect(username.autofillHints, contains(AutofillHints.username));
    expect(username.style!.fontSize, greaterThanOrEqualTo(16));

    final code = tester.widget<TextField>(
      find.byKey(const Key('setup-code-field')),
    );
    expect(code.maxLength, 6);
    expect(code.textCapitalization, TextCapitalization.characters);
    expect(code.textInputAction, TextInputAction.done);
    expect(code.autocorrect, isFalse);
    expect(code.style!.fontSize, greaterThanOrEqualTo(16));

    final fieldHeight = tester
        .getSize(find.byKey(const Key('username-field')))
        .height;
    expect(fieldHeight, greaterThanOrEqualTo(48));
  });

  testWidgets('done on the setup code field submits the form', (tester) async {
    api.onStatus = () => const WorkerStatus(registered: false);
    api.onRegister = (_, _) => registered();
    await pumpApp(tester);

    await tester.enterText(find.byKey(const Key('username-field')), 'ada');
    await tester.enterText(find.byKey(const Key('setup-code-field')), 'ABCDEF');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();

    expect(api.registerCalls, 1);
    expect(find.text('Clock in'), findsOneWidget);
  });

  testWidgets('setup shows the logo and keeps its button in the card', (
    tester,
  ) async {
    api.onStatus = () => const WorkerStatus(registered: false);
    api.onRegister = (_, _) => registered();
    await pumpApp(tester);

    expect(find.byKey(const Key('brand-logo')), findsOneWidget);
    final card = tester.getRect(find.byType(BrandCard));
    final register = tester.getRect(find.byKey(const Key('register-button')));
    expect(card.contains(register.center), isTrue);
    expect(register.bottom, lessThan(844));
    expect(register.height, greaterThanOrEqualTo(48));
  });

  testWidgets('clock-in action sits in the thumb zone', (tester) async {
    api.onStatus = () => const WorkerStatus(registered: false);
    api.onRegister = (_, _) => registered();
    await pumpApp(tester);

    await tester.enterText(find.byKey(const Key('username-field')), 'ada');
    await tester.enterText(find.byKey(const Key('setup-code-field')), 'ABCDEF');
    await tester.pump();
    await tester.tap(find.byKey(const Key('register-button')));
    await tester.pumpAndSettle();

    final clockIn = tester.getRect(find.byKey(const Key('clock-in-button')));
    expect(clockIn.bottom, greaterThan(844 - 40));
    expect(clockIn.height, greaterThanOrEqualTo(64));
  });

  testWidgets('setup button scrolls into view above the on-screen keyboard', (
    tester,
  ) async {
    api.onStatus = () => const WorkerStatus(registered: false);
    tester.view.physicalSize = const Size(360 * 3, 740 * 3);
    tester.view.devicePixelRatio = 3;
    tester.view.viewInsets = const FakeViewPadding(bottom: 300 * 3);
    addTearDown(tester.view.reset);
    await tester.pumpWidget(WorkerApp(controller: controller));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.byKey(const Key('register-button')));
    await tester.pumpAndSettle();
    final button = tester.getRect(find.byKey(const Key('register-button')));
    expect(button.bottom, lessThanOrEqualTo(740 - 300));
    expect(tester.takeException(), isNull);
  });

  testWidgets('clock-in shows today and progress while submitting', (
    tester,
  ) async {
    api.onStatus = () => registered();
    final pending = Completer<ClockInResult>();
    api.onClockIn = () => pending.future;
    await pumpApp(tester);

    expect(find.text(formatDay(DateTime.now())), findsOneWidget);
    expect(find.byKey(const Key('worker-department')), findsOneWidget);

    await tester.tap(find.byKey(const Key('clock-in-button')));
    await tester.pump();

    final button = tester.widget<FilledButton>(
      find.descendant(
        of: find.byKey(const Key('clock-in-button')),
        matching: find.byType(FilledButton),
      ),
    );
    expect(button.onPressed, isNull);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    await tester.tap(find.byKey(const Key('clock-in-button')));
    expect(api.clockInCalls, 1);

    pending.complete(
      ClockInResult(
        alreadyClockedIn: false,
        clockInDate: '2026-10-18',
        clockedInAt: DateTime(2026, 10, 18, 7, 14),
        worker: testWorker,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text("You're clocked in"), findsOneWidget);
  });

  for (final size in const [Size(320, 568), Size(430, 932), Size(844, 390)]) {
    testWidgets('screens lay out without overflow at '
        '${size.width.toInt()}x${size.height.toInt()}', (tester) async {
      tester.view.physicalSize = size * 2;
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);

      api.onStatus = () => const WorkerStatus(registered: false);
      api.onRegister = (_, _) =>
          throw const ApiException(401, 'Invalid username or setup code');
      api.onClockIn = () => ClockInResult(
        alreadyClockedIn: true,
        clockInDate: '2026-10-18',
        clockedInAt: DateTime(2026, 10, 18, 7, 14),
        worker: testWorker,
      );
      await tester.pumpWidget(WorkerApp(controller: controller));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('username-field')), 'ada');
      await tester.enterText(
        find.byKey(const Key('setup-code-field')),
        'XXXXXX',
      );
      await tester.pump();
      await tester.ensureVisible(find.byKey(const Key('register-button')));
      await tester.tap(find.byKey(const Key('register-button')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('error-banner')), findsOneWidget);
      expect(tester.takeException(), isNull);

      api.onStatus = () => registered();
      await controller.bootstrap();
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('clock-in-button')));
      await tester.tap(find.byKey(const Key('clock-in-button')));
      await tester.pumpAndSettle();
      expect(find.text('Sunday, Oct 18 at 07:14 AM'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('content is a centered column on wide screens', (tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    api.onStatus = () => registered();
    await tester.pumpWidget(WorkerApp(controller: controller));
    await tester.pumpAndSettle();

    final button = tester.getRect(find.byKey(const Key('clock-in-button')));
    expect(button.width, lessThanOrEqualTo(440));
    expect(button.center.dx, closeTo(640, 1));
  });

  testWidgets('user-facing text has no en or em dashes', (tester) async {
    api.onStatus = () => registered();
    api.onClockIn = () => ClockInResult(
      alreadyClockedIn: true,
      clockInDate: '2026-10-18',
      clockedInAt: DateTime(2026, 10, 18, 7, 14),
      worker: testWorker,
    );
    await pumpApp(tester);

    void expectNoDashes() {
      for (final text in tester.widgetList<Text>(find.byType(Text))) {
        expect(text.data ?? '', isNot(matches(RegExp('[\u2013\u2014]'))));
      }
    }

    expectNoDashes();
    await tester.tap(find.byKey(const Key('clock-in-button')));
    await tester.pumpAndSettle();
    expectNoDashes();
  });
}
