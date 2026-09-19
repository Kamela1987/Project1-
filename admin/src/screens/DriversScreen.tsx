import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Driver, DriverVerificationStatus } from '../lib/types';

const TABS: { label: string; status?: DriverVerificationStatus }[] = [
  { label: 'Pending', status: 'pending' },
  { label: 'Approved', status: 'approved' },
  { label: 'All' },
];

export function DriversScreen() {
  const [tab, setTab] = useState(0);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Driver | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const status = TABS[tab].status;
      const result = await api.get<Driver[]>(`/drivers${status ? `?status=${status}` : ''}`);
      setDrivers(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load drivers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function approve(driverId: string) {
    await api.patch(`/drivers/${driverId}/approve`, {});
    await refresh();
  }

  async function openDetail(driverId: string) {
    const detail = await api.get<Driver>(`/drivers/${driverId}`);
    setSelected(detail);
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Drivers</h1>

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {TABS.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === i
                ? 'border-b-2 border-teal-700 text-teal-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : drivers.length === 0 ? (
        <p className="text-sm text-slate-500">No drivers here.</p>
      ) : (
        <table className="w-full border-collapse overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">License</th>
              <th className="px-4 py-2">Vehicle</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Online</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{d.user?.name ?? '—'}</td>
                <td className="px-4 py-2">{d.user?.phoneNumber ?? '—'}</td>
                <td className="px-4 py-2">{d.licenseNumber}</td>
                <td className="px-4 py-2">
                  {d.vehicle ? `${d.vehicle.type} · ${d.vehicle.plateNumber}` : 'Not registered'}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={d.verificationStatus} />
                </td>
                <td className="px-4 py-2">{d.isOnline ? 'Online' : 'Offline'}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => openDetail(d.id)}
                    className="mr-2 text-teal-700 hover:underline"
                  >
                    View
                  </button>
                  {d.verificationStatus === 'pending' && (
                    <button
                      onClick={() => approve(d.id)}
                      className="rounded bg-teal-700 px-3 py-1 text-white hover:bg-teal-800"
                    >
                      Approve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <DriverDetailModal
          driver={selected}
          onClose={() => setSelected(null)}
          onSettled={refresh}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: DriverVerificationStatus }) {
  const colors: Record<DriverVerificationStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}>
      {status}
    </span>
  );
}

function DriverDetailModal({
  driver,
  onClose,
  onSettled,
}: {
  driver: Driver;
  onClose: () => void;
  onSettled: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owed = (driver.walletBalance ?? 0) < 0;

  async function settle(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/drivers/${driver.id}/wallet/settlements`, {
        amount: Number(amount),
        note: note || undefined,
      });
      onSettled();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record settlement');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{driver.user?.name}</h2>
            <p className="text-sm text-slate-500">{driver.user?.phoneNumber}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-slate-500">License</dt>
          <dd>{driver.licenseNumber}</dd>
          <dt className="text-slate-500">Vehicle</dt>
          <dd>
            {driver.vehicle ? `${driver.vehicle.type} · ${driver.vehicle.plateNumber}` : '—'}
          </dd>
          <dt className="text-slate-500">Rating</dt>
          <dd>
            {driver.rating?.count ? `★ ${driver.rating.average} (${driver.rating.count})` : 'Not yet rated'}
          </dd>
          <dt className="text-slate-500">Wallet balance</dt>
          <dd className={owed ? 'font-medium text-red-600' : 'font-medium text-green-700'}>
            K{(driver.walletBalance ?? 0).toFixed(2)}
            {owed && ' (owed to platform)'}
          </dd>
        </dl>

        {owed && (
          <form onSubmit={settle} className="border-t border-slate-200 pt-4">
            <p className="mb-2 text-sm font-medium">Record a commission settlement</p>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
                required
              />
              <input
                type="text"
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-teal-700 px-3 py-1 text-sm text-white hover:bg-teal-800 disabled:opacity-50"
              >
                Record
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
