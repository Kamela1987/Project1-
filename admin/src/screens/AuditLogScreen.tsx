import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { AuditLogEntry, Page } from '../lib/types';

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<AuditLogEntry['action'], string> = {
  'driver.approved': 'Approved driver',
  'dispute.resolved': 'Resolved dispute',
};

export function AuditLogScreen() {
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<Page<AuditLogEntry>>(`/audit-log?page=${page}&pageSize=${PAGE_SIZE}`)
      .then((result) => {
        if (cancelled) return;
        setEntries(result.items);
        setTotal(result.total);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Could not load audit log');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Audit log</h1>
      <p className="mb-4 text-sm text-slate-500">
        Who approved a driver, and who resolved a dispute — every admin account can act, so this is
        how each action stays attributable.
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500">No admin actions recorded yet.</p>
      ) : (
        <table className="w-full border-collapse overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Admin</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Target</th>
              <th className="px-4 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-2 whitespace-nowrap text-slate-500">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  {e.actorName ?? 'Unknown'}
                  <div className="text-xs text-slate-400">{e.actorPhoneNumber}</div>
                </td>
                <td className="px-4 py-2">{ACTION_LABELS[e.action] ?? e.action}</td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{e.targetId.slice(0, 8)}</td>
                <td className="px-4 py-2 text-slate-600">
                  {e.metadata?.resolutionNote ? String(e.metadata.resolutionNote) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * PAGE_SIZE >= total}
              className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
