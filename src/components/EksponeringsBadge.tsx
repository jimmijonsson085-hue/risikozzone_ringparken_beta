import React from 'react';
import { AlertOctagon, ShieldCheck, AlertTriangle } from 'lucide-react';
import { ReceptorExposureResult } from '../types/dispersion';

export interface EksponeringsBadgeProps {
  selectedReceptor: ReceptorExposureResult;
  allReceptors?: ReceptorExposureResult[];
  onSelectReceptor?: (receptorId: string) => void;
}

export const EksponeringsBadge: React.FC<EksponeringsBadgeProps> = ({
  selectedReceptor,
  allReceptors,
  onSelectReceptor,
}) => {
  const s = selectedReceptor.sumQuotient;

  // ANSI/ISA-101 Visual Silence & ISA-18.2 Color Containment + Triple Redundancy:
  // Calm slate in normal state (S < 0.25), calibrated amber (0.25 <= S < 1.0), P1 crimson left-accent (S >= 1.0)
  const tier =
    s >= 1.0
      ? {
          levelKey: 'red' as const,
          labelDa: 'KRITISK · S ≥ 1,0',
          containerClass:
            'bg-[var(--surface-card)] border-[var(--border-subtle)] border-l-4 border-l-rose-500 text-[var(--text-primary)]',
          pillClass: 'bg-rose-600 text-white border-rose-400',
          Icon: AlertOctagon,
          iconClass: 'text-[#F87171] animate-pulse',
        }
      : s >= 0.25
      ? {
          levelKey: 'amber' as const,
          labelDa: 'ADVARSEL · 0,25–1,0',
          containerClass:
            'bg-[var(--surface-card)] border-[var(--border-subtle)] border-l-4 border-l-amber-400 text-[var(--text-primary)]',
          pillClass: 'bg-amber-500/15 text-[#FBBF24] border-amber-400/60',
          Icon: AlertTriangle,
          iconClass: 'text-[#FBBF24]',
        }
      : {
          levelKey: 'green' as const,
          labelDa: 'NORMAL · S < 0,25',
          containerClass:
            'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)]',
          pillClass: 'bg-[var(--surface-panel)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
          Icon: ShieldCheck,
          iconClass: 'text-[var(--status-normal-text)]',
        };

  const { Icon } = tier;

  return (
    <div
      data-testid="eksponerings-badge"
      data-exposure-tier={tier.levelKey}
      data-sum-quotient={s.toFixed(2)}
      className={`mx-2 mt-2 mb-1.5 px-3 py-1.5 rounded-md border flex flex-wrap items-center justify-between gap-2 font-mono tabular-nums text-xs transition-colors shrink-0 ${tier.containerClass}`}
      title={`Eksponerings-Badge for valgt receptor (${selectedReceptor.receptorCode} — ${selectedReceptor.receptorName}): Sum-kvotient S = ${s.toFixed(2)} [Normal: S < 0,25 · Advarsel: 0,25–1,0 · Kritisk: S ≥ 1,0]`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`w-4 h-4 shrink-0 ${tier.iconClass}`} />
        <span className="font-semibold tracking-tight text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
          Receptor:
        </span>
        {allReceptors && allReceptors.length > 0 && onSelectReceptor ? (
          <select
            value={selectedReceptor.receptorId}
            onChange={(e) => onSelectReceptor(e.target.value)}
            aria-label="Vælg receptor til Eksponerings-Badge"
            className="bg-[var(--surface-panel)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-slate-500 rounded px-2 py-0.5 text-[11px] font-semibold max-w-[190px] truncate focus:outline-none focus:border-[#38BDF8] cursor-pointer tabular-nums"
          >
            {allReceptors.map((rec) => (
              <option key={rec.receptorId} value={rec.receptorId} className="bg-[var(--surface-panel)] text-[var(--text-primary)]">
                {rec.receptorCode} · {rec.receptorName} (S={rec.sumQuotient.toFixed(2)})
              </option>
            ))}
          </select>
        ) : (
          <span className="font-semibold text-[11px] truncate max-w-[190px]">
            {selectedReceptor.receptorCode} · {selectedReceptor.receptorName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`px-2 py-0.5 rounded border text-[11px] font-bold tracking-wide tabular-nums ${tier.pillClass}`}
        >
          S = {s.toFixed(2).replace('.', ',')}
        </span>
        <span className="text-[11px] font-semibold text-[var(--text-secondary)] hidden sm:inline whitespace-nowrap">
          {tier.labelDa}
        </span>
      </div>
    </div>
  );
};
