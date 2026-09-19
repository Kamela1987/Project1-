import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { FareRule, VehicleType, Zone } from '../lib/types';

const VEHICLE_TYPES: VehicleType[] = ['sedan', 'minibus', 'motorbike'];

export function ZonesScreen() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refreshZones() {
    try {
      const result = await api.get<Zone[]>('/zones');
      setZones(result);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load zones');
    }
  }

  useEffect(() => {
    refreshZones();
  }, []);

  async function createZone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/zones', { name: newZoneName });
      setNewZoneName('');
      await refreshZones();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create zone');
    }
  }

  async function deleteZone(id: string) {
    await api.delete(`/zones/${id}`);
    if (selectedZone?.id === id) setSelectedZone(null);
    await refreshZones();
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Zones & fares</h1>
      <p className="mb-4 max-w-xl text-sm text-slate-500">
        A zone with a boundary and per-vehicle-type fare rules feeds the rider's real fare
        estimate — configure that here. Trip completion still takes a driver-entered fare,
        unchanged on purpose: a cash fare agreed in person can legitimately differ from the
        estimate.
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-[280px_1fr] gap-6">
        <div>
          <form onSubmit={createZone} className="mb-4 flex gap-2">
            <input
              type="text"
              placeholder="New zone name"
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
              required
            />
            <button
              type="submit"
              className="rounded bg-teal-700 px-3 py-1.5 text-sm text-white hover:bg-teal-800"
            >
              Add
            </button>
          </form>

          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {zones.map((z) => (
              <li
                key={z.id}
                className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer ${
                  selectedZone?.id === z.id ? 'bg-teal-50' : 'hover:bg-slate-50'
                }`}
                onClick={() => setSelectedZone(z)}
              >
                <span>{z.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteZone(z.id);
                  }}
                  className="text-slate-400 hover:text-red-600"
                >
                  Delete
                </button>
              </li>
            ))}
            {zones.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No zones yet.</li>}
          </ul>
        </div>

        <div>{selectedZone && <FareRulesPanel zone={selectedZone} />}</div>
      </div>
    </div>
  );
}

function FareRulesPanel({ zone }: { zone: Zone }) {
  const [rules, setRules] = useState<FareRule[]>([]);
  const [vehicleType, setVehicleType] = useState<VehicleType>('sedan');
  const [baseFare, setBaseFare] = useState('');
  const [perKmRate, setPerKmRate] = useState('');
  const [perMinRate, setPerMinRate] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const result = await api.get<FareRule[]>(`/zones/${zone.id}/fare-rules`);
    setRules(result);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.id]);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/zones/${zone.id}/fare-rules`, {
        vehicleType,
        baseFare: Number(baseFare),
        perKmRate: Number(perKmRate),
        perMinRate: Number(perMinRate),
      });
      setBaseFare('');
      setPerKmRate('');
      setPerMinRate('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create fare rule');
    }
  }

  async function deleteRule(id: string) {
    await api.delete(`/fare-rules/${id}`);
    await refresh();
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">{zone.name} — fare rules</h2>

      <table className="mb-4 w-full border-collapse overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2">Vehicle</th>
            <th className="px-4 py-2">Base fare</th>
            <th className="px-4 py-2">Per km</th>
            <th className="px-4 py-2">Per min</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-4 py-2">{r.vehicleType}</td>
              <td className="px-4 py-2">K{r.baseFare}</td>
              <td className="px-4 py-2">K{r.perKmRate}</td>
              <td className="px-4 py-2">K{r.perMinRate}</td>
              <td className="px-4 py-2 text-right">
                <button onClick={() => deleteRule(r.id)} className="text-slate-400 hover:text-red-600">
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {rules.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-3 text-slate-400">
                No fare rules for this zone yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form onSubmit={createRule} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Vehicle
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value as VehicleType)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {VEHICLE_TYPES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Base fare (K)
          <input
            type="number"
            step="0.01"
            min="0"
            value={baseFare}
            onChange={(e) => setBaseFare(e.target.value)}
            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Per km (K)
          <input
            type="number"
            step="0.01"
            min="0"
            value={perKmRate}
            onChange={(e) => setPerKmRate(e.target.value)}
            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Per min (K)
          <input
            type="number"
            step="0.01"
            min="0"
            value={perMinRate}
            onChange={(e) => setPerMinRate(e.target.value)}
            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
            required
          />
        </label>
        <button
          type="submit"
          className="rounded bg-teal-700 px-3 py-1.5 text-sm text-white hover:bg-teal-800"
        >
          Add rule
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
