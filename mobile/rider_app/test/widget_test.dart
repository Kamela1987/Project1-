import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:monze_rider/main.dart';

void main() {
  testWidgets('boots to the login screen', (WidgetTester tester) async {
    await tester.pumpWidget(const MonzeRiderApp());

    expect(find.text('MONZE MOTO'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'Phone number (+260…)'), findsOneWidget);
    expect(find.text('Send code'), findsOneWidget);
  });
}
