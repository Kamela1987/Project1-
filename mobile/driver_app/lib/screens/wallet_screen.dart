import 'package:flutter/material.dart';
import '../services/api_client.dart';

/// Shows the driver what they owe the platform in commission (Phase 1 is
/// cash-only, so the driver already holds the fare — this balance is a
/// debt, not a payout). See backend/README.md "How the platform (admin)
/// makes money".
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  final _api = ApiClient();
  double? _balance;
  List<dynamic> _entries = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    try {
      final json = await _api.myWallet();
      if (!mounted) return;
      setState(() {
        _balance = (json['balance'] as num).toDouble();
        _entries = json['entries'] as List<dynamic>;
      });
    } catch (e) {
      setState(() => _error = 'Could not load wallet: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final balance = _balance;
    final owed = balance != null && balance < 0;
    return Scaffold(
      appBar: AppBar(title: const Text('My wallet')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
            if (balance == null)
              const Center(child: CircularProgressIndicator())
            else ...[
              Text(
                owed
                    ? 'You owe K${(-balance).toStringAsFixed(2)} in platform commission'
                    : 'Balance: K${balance.toStringAsFixed(2)}',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: owed ? Colors.red : Colors.green,
                ),
              ),
              if (owed)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text(
                    'Settle this with an admin to keep going online. '
                    'Going online is blocked once you owe more than K100.',
                  ),
                ),
              const Divider(height: 32),
              const Text('Recent activity', style: TextStyle(fontWeight: FontWeight.bold)),
              for (final entry in _entries)
                ListTile(
                  title: Text(_labelFor(entry['type'] as String)),
                  subtitle: entry['note'] != null ? Text(entry['note'] as String) : null,
                  trailing: Text(
                    'K${entry['amount']}',
                    style: TextStyle(
                      color: (entry['amount'] as String).startsWith('-') ? Colors.red : Colors.green,
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  String _labelFor(String type) {
    switch (type) {
      case 'commission':
        return 'Platform commission';
      case 'settlement':
        return 'Settlement paid';
      case 'trip_earning':
        return 'Trip earning';
      default:
        return type;
    }
  }
}
