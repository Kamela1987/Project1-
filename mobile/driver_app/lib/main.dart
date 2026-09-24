import 'package:flutter/material.dart';
import 'screens/login_screen.dart';

void main() {
  runApp(const MonzeDriverApp());
}

class MonzeDriverApp extends StatelessWidget {
  const MonzeDriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Monze Moto — Driver',
      theme: ThemeData(colorSchemeSeed: Colors.orange, useMaterial3: true),
      home: const LoginScreen(),
    );
  }
}
