/// Mirrors backend/src/entities/payment-method.enum.ts PaymentMethod.
enum PaymentMethod {
  cash,
  momo,
  airtel;

  String get apiValue => name;

  String get label {
    switch (this) {
      case PaymentMethod.cash:
        return 'Cash';
      case PaymentMethod.momo:
        return 'MTN MoMo';
      case PaymentMethod.airtel:
        return 'Airtel Money';
    }
  }

  static PaymentMethod fromApiValue(String value) {
    return PaymentMethod.values.firstWhere((v) => v.apiValue == value);
  }
}

enum PaymentStatus {
  pending,
  collected,
  failed;

  static PaymentStatus fromApiValue(String value) {
    return PaymentStatus.values.firstWhere((v) => v.name == value);
  }
}
