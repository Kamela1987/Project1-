import 'package:flutter/material.dart';
import '../services/api_client.dart';
import 'request_ride_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _api = ApiClient();
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _nameController = TextEditingController();
  bool _otpSent = false;
  bool _loading = false;
  String? _error;

  Future<void> _requestOtp() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _api.requestOtp(_phoneController.text.trim());
      setState(() => _otpSent = true);
    } catch (e) {
      setState(() => _error = 'Could not send code: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _verifyOtp() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _api.verifyOtp(
        _phoneController.text.trim(),
        _otpController.text.trim(),
        name: _nameController.text.trim().isEmpty ? null : _nameController.text.trim(),
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const RequestRideScreen()),
      );
    } catch (e) {
      setState(() => _error = 'Invalid code: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Monze Ride')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _phoneController,
              enabled: !_otpSent,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Phone number (+260…)'),
            ),
            if (_otpSent) ...[
              const SizedBox(height: 16),
              TextField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Your name (first time only)'),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _otpController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Code from SMS'),
              ),
            ],
            const SizedBox(height: 24),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            FilledButton(
              onPressed: _loading ? null : (_otpSent ? _verifyOtp : _requestOtp),
              child: Text(_otpSent ? 'Verify & continue' : 'Send code'),
            ),
          ],
        ),
      ),
    );
  }
}
