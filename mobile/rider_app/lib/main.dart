import 'package:flutter/material.dart';
import 'screens/login_screen.dart';

void main() {
  runApp(const MonzeRiderApp());
}

class MonzeRiderApp extends StatelessWidget {
  const MonzeRiderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Monze Ride',
      theme: ThemeData(colorSchemeSeed: Colors.teal, useMaterial3: true),
      home: const LoginScreen(),
    );
  }
}
