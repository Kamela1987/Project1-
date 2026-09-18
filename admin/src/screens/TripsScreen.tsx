import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Trip, TripStatus } from '../lib/types';

const STATUSES: { label: string; value?: TripStatus }[] = [
  { label: 'All' },
  { label: 'Requested', value: 'requested' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Arrived', value: 'arrived' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const STATUS_COLORS: Record<TripStatus, string> = {
  requested: 'bg-slate-100 text-slate-700',
  accepted: 'bg-blue-100 text-blue-800',
  arrived: 'bg-indigo-100 text-indigo-800',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function TripsScreen() {
  const [statusFilter, setStatusFilter] = useState<TripStatus | ''>('');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const query = statusFilter ? `?status=${statusFilter}` : '';
      const result = await api.get<Trip[]>(`/trips${query}`);
      setTrips(result);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load trips');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Live trips</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TripStatus | '')}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s.label} value={s.value ?? ''}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : trips.length === 0 ? (
        <p className="text-sm text-slate-500">No trips match this filter.</p>
      ) : (
        <table className="w-full border-collapse overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Trip</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Vehicle</th>
              <th className="px-4 py-2">Payment</th>
              <th className="px-4 py-2">Fare</th>
              <th className="px-4 py-2">Requested</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{t.id.slice(0, 8)}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status]}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-2">{t.requestedVehicleType ?? 'any'}</td>
                <td className="px-4 py-2">{t.paymentMethod}</td>
                <td className="px-4 py-2">{t.fareAmount ? `K${t.fareAmount}` : '—'}</td>
                <td className="px-4 py-2 text-slate-500">
                  {new Date(t.requestedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
