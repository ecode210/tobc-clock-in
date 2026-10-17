import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../theme.dart';

const maxContentWidth = 440.0;

/// Below this body height the action scrolls with the content instead of
/// being pinned, so short landscape viewports with the keyboard up still work.
const _minPinnedHeight = 320.0;

/// Phone page shell: the church logo, a white rounded card holding [child],
/// and an optional primary [action] pinned to the bottom (thumb zone), above
/// the home indicator and the on-screen keyboard. On wide screens it is a
/// centered column.
class BrandScaffold extends StatelessWidget {
  const BrandScaffold({
    super.key,
    required this.child,
    this.action,
    this.centerBody = false,
  });

  final Widget child;
  final Widget? action;

  /// Vertically centers the logo and card in the space above [action].
  final bool centerBody;

  static const _hPad = 20.0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: maxContentWidth),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final pinned =
                    action == null || constraints.maxHeight >= _minPinnedHeight;
                return pinned ? _pinnedLayout() : _inlineLayout();
              },
            ),
          ),
        ),
      ),
    );
  }

  Widget get _body => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const BrandLogo(),
      const SizedBox(height: 28),
      BrandCard(child: child),
    ],
  );

  Widget _pinnedLayout() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) => SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.fromLTRB(_hPad, 28, _hPad, 20),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: (constraints.maxHeight - 48).clamp(
                    0,
                    double.infinity,
                  ),
                ),
                child: centerBody
                    ? Center(child: _body)
                    : Align(alignment: Alignment.topCenter, child: _body),
              ),
            ),
          ),
        ),
        if (action != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(_hPad, 8, _hPad, 16),
            child: action,
          ),
      ],
    );
  }

  Widget _inlineLayout() {
    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.fromLTRB(_hPad, 16, _hPad, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [_body, const SizedBox(height: 16), action!],
      ),
    );
  }
}

class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.height = 56});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SvgPicture.asset(
        'assets/images/logo.svg',
        key: const Key('brand-logo'),
        height: height,
        semanticsLabel: 'The Olivebrook Church',
      ),
    );
  }
}

class BrandCard extends StatelessWidget {
  const BrandCard({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(22, 28, 22, 24),
      decoration: BoxDecoration(
        color: Brand.surface,
        borderRadius: BorderRadius.circular(32),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D1E1430),
            blurRadius: 24,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: child,
    );
  }
}
