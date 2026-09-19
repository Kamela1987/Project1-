import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:monze_driver/main.dart';

void main() {
  testWidgets('boots to the login screen', (WidgetTester tester) async {
    await tester.pumpWidget(const MonzeDriverApp());

    expect(find.text('Monze Ride — Driver'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'Phone number (+260…)'), findsOneWidget);
    expect(find.text('Send code'), findsOneWidget);
  });
}
