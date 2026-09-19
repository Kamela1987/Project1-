import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Dispute, DisputeStatus } from '../lib/types';

const TABS: { label: string; status?: DisputeStatus }[] = [
  { label: 'Open', status: 'open' },
  { label: 'Resolved', status: 'resolved' },
  { label: 'All' },
];

export function DisputesScreen() {
  const [tab, setTab] = useState(0);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<Dispute | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const status = TABS[tab].status;
      const result = await api.get<Dispute[]>(`/disputes${status ? `?status=${status}` : ''}`);
      setDisputes(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load disputes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Disputes</h1>

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
      ) : disputes.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing here.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {disputes.map((d) => (
            <li key={d.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-xs text-slate-500">Trip {d.tripId.slice(0, 8)}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    d.status === 'open' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                  }`}
                >
                  {d.status}
                </span>
              </div>
              <p className="mb-2 text-sm">{d.reason}</p>
              <p className="mb-2 text-xs text-slate-400">
                Raised {new Date(d.createdAt).toLocaleString()}
              </p>
              {d.resolutionNote && (
                <p className="rounded bg-slate-50 p-2 text-sm text-slate-700">
                  <span className="font-medium">Resolution: </span>
                  {d.resolutionNote}
                </p>
              )}
              {d.status === 'open' && (
                <button
                  onClick={() => setResolving(d)}
                  className="mt-2 rounded bg-teal-700 px-3 py-1 text-sm text-white hover:bg-teal-800"
                >
                  Resolve
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {resolving && (
        <ResolveDisputeModal
          dispute={resolving}
          onClose={() => setResolving(null)}
          onResolved={refresh}
        />
      )}
    </div>
  );
}

function ResolveDisputeModal({
  dispute,
  onClose,
  onResolved,
}: {
  dispute: Dispute;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/disputes/${dispute.id}/resolve`, { resolutionNote: note });
      onResolved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resolve dispute');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-2 text-lg font-bold">Resolve dispute</h2>
        <p className="mb-4 text-sm text-slate-600">{dispute.reason}</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What was done to resolve this?"
          className="mb-4 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          rows={3}
          required
        />
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-teal-700 px-3 py-1.5 text-sm text-white hover:bg-teal-800 disabled:opacity-50"
          >
            Mark resolved
          </button>
        </div>
      </form>
    </div>
  );
}
