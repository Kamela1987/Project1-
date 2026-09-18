import 'package:flutter/material.dart';
import '../services/api_client.dart';

/// Shows the driver's wallet balance: negative means they owe the platform
/// commission on cash fares already collected; positive means they've
/// earned net income from mobile money trips (platform held the fare) that
/// they can cash out. See backend/README.md "How the platform (admin)
/// makes money" and "Mobile money (Phase 2)".
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
  bool _payingOut = false;

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

  Future<void> _payout() async {
    final balance = _balance;
    if (balance == null || balance <= 0) return;
    final method = await showDialog<String>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Cash out via'),
        children: [
          SimpleDialogOption(
            onPressed: () => Navigator.pop(context, 'momo'),
            child: const Text('MTN MoMo'),
          ),
          SimpleDialogOption(
            onPressed: () => Navigator.pop(context, 'airtel'),
            child: const Text('Airtel Money'),
          ),
        ],
      ),
    );
    if (method == null) return;

    setState(() {
      _payingOut = true;
      _error = null;
    });
    try {
      await _api.requestPayout(amount: balance, method: method);
      await _refresh();
    } catch (e) {
      setState(() => _error = 'Payout failed: $e');
    } finally {
      setState(() => _payingOut = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final balance = _balance;
    final owed = balance != null && balance < 0;
    final canPayout = balance != null && balance > 0;
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
              if (canPayout)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: FilledButton(
                    onPressed: _payingOut ? null : _payout,
                    child: const Text('Cash out to mobile money'),
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
        return 'Trip earning (mobile money)';
      case 'payout':
        return 'Cashed out';
      default:
        return type;
    }
  }
}
