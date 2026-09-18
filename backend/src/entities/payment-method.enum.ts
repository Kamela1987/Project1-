/**
 * Split out from payment.entity.ts so Trip can reference PaymentMethod
 * (a rider's preferred payment method) without a circular import between
 * trip.entity.ts and payment.entity.ts.
 */
export enum PaymentMethod {
  CASH = 'cash',
  MOMO = 'momo',
  AIRTEL = 'airtel',
}

export enum PaymentStatus {
  /** Mobile money request sent to the rider, awaiting their approval/provider callback. */
  PENDING = 'pending',
  COLLECTED = 'collected',
  FAILED = 'failed',
}
