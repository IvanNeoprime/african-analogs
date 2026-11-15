import React, { useId } from 'react';
import { Plus, X } from 'lucide-react';

export interface MineralRow {
  id: string;
  name: string;
  /** Kept as text so the field can be empty while typing. */
  pct: string;
}

let rowSeq = 0;
export const newMineralRow = (name = '', pct = ''): MineralRow => ({ id: `m-${Date.now()}-${rowSeq++}`, name, pct });

export const rowsFromMinerals = (minerals: Record<string, number>): MineralRow[] =>
  Object.entries(minerals).map(([name, pct]) => newMineralRow(name, String(pct)));

/** Only complete rows (name + positive %) count; nothing is guessed. */
export const mineralsFromRows = (rows: MineralRow[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const name = r.name.trim();
    const pct = parseFloat(r.pct.replace(',', '.'));
    if (name && Number.isFinite(pct) && pct > 0) out[name] = pct;
  }
  return out;
};

const COMMON_MINERALS = [
  'Basalto', 'Olivina', 'Piroxênio', 'Plagioclásio', 'Anortosito', 'Ilmenita', 'Magnetita', 'Hematita',
  'Goethita', 'Jarosita', 'Gesso', 'Anidrita', 'Halita', 'Perclorato', 'Esmectita', 'Montmorilonita',
  'Caulinita', 'Calcita', 'Dolomita', 'Trona', 'Natrão', 'Serpentina', 'Brucita', 'Opala', 'Quartzo',
  'Enxofre nativo', 'Pirita', 'Gelo', 'Matéria orgânica',
];

interface MineralEditorProps {
  rows: MineralRow[];
  onChange: (rows: MineralRow[]) => void;
  /** Extra names offered while typing (e.g. minerals of the catalogue sites). */
  suggestions?: string[];
}

export const MineralEditor: React.FC<MineralEditorProps> = ({ rows, onChange, suggestions = [] }) => {
  const listId = useId();
  const options = [...new Set([...COMMON_MINERALS, ...suggestions])].sort((a, b) => a.localeCompare(b, 'pt'));

  const total = rows.reduce((sum, r) => {
    const v = parseFloat(r.pct.replace(',', '.'));
    return sum + (Number.isFinite(v) && v > 0 ? v : 0);
  }, 0);
  const totalRounded = Math.round(total * 10) / 10;
  const incomplete = rows.filter((r) => (r.name.trim() && !r.pct.trim()) || (!r.name.trim() && r.pct.trim())).length;
  const totalOk = Math.abs(total - 100) <= 0.5;

  const update = (id: string, patch: Partial<MineralRow>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-1">Minerais observados (% em massa)</legend>
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>

      {rows.length === 0 && (
        <p className="text-xs text-[#64748B] dark:text-[#8B949E] p-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#161B22]">
          Ainda sem minerais. Sem minerais a semelhança não pode ser calculada.
        </p>
      )}

      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.id} className="flex items-center gap-1.5">
            <input
              type="text"
              list={listId}
              value={r.name}
              onChange={(e) => update(r.id, { name: e.target.value })}
              placeholder="Mineral (ex.: Hematita)"
              aria-label={`Mineral ${i + 1}`}
              className="flex-1 min-w-0 bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] text-sm px-3 py-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
            />
            <div className="relative w-24 shrink-0">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.1"
                value={r.pct}
                onChange={(e) => update(r.id, { pct: e.target.value })}
                placeholder="%"
                aria-label={`Percentagem de ${r.name || `mineral ${i + 1}`}`}
                className="w-full bg-[#FFFFFF] dark:bg-[#161B22] text-[#0F172A] dark:text-[#F0F6FC] font-mono text-sm pl-3 pr-7 py-2 rounded-xl tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
              />
              <span aria-hidden="true" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748B]">%</span>
            </div>
            <button
              type="button"
              onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
              aria-label={`Remover ${r.name || `mineral ${i + 1}`}`}
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-[#64748B] hover:text-[#B91C1C] hover:bg-[#FFFFFF] dark:hover:bg-[#161B22] cursor-pointer"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => onChange([...rows, newMineralRow()])}
          className="py-1.5 px-3 rounded-lg bg-[#FFFFFF] dark:bg-[#161B22] text-[#1E3A8A] dark:text-[#60A5FA] text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
          Adicionar mineral
        </button>
        {rows.length > 0 && (
          <span
            aria-live="polite"
            className={`text-xs font-medium tabular-nums ${
              totalOk ? 'text-[#15803D] dark:text-[#4ADE80]' : 'text-[#B45309] dark:text-[#FBBF24]'
            }`}
          >
            Total: {totalRounded}%
            {!totalOk && (total < 100 ? ` · faltam ${Math.round((100 - total) * 10) / 10}%` : ' · passa de 100%')}
          </span>
        )}
      </div>
      {incomplete > 0 && (
        <p className="text-xs text-[#B45309] dark:text-[#FBBF24]">
          {incomplete === 1 ? '1 linha incompleta' : `${incomplete} linhas incompletas`} (falta o nome ou a percentagem) — não entra no cálculo.
        </p>
      )}
    </fieldset>
  );
};
