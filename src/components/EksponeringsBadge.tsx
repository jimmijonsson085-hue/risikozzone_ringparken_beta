import React from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
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

  // Strict color thresholds:
  // Green for S < 0.25, Amber for 0.25 <= S < 1.0, Red for S >= 1.0
  const tier =
    s >= 1.0
      ? {
          levelKey: 'red' as const,
          labelDa: 'RØD · S ≥ 1,0',
          containerClass:
            'bg-rose-950/95 border-rose-500 text-rose-100 ring-1 ring-rose-500/45',
          pillClass: 'bg-rose-600 text-white border-rose-300',
          dotClass: 'bg-rose-400',
          Icon: ShieldAlert,
          iconClass: 'text-rose-400',
        }
      : s >= 0.25
      ? {
          levelKey: 'amber' as const,
          labelDa: 'AMBER · 0,25–1,0',
          containerClass:
            'bg-amber-950/95 border-amber-400 text-amber-100 ring-1 ring-amber-400/40',
          pillClass: 'bg-amber-500 text-slate-950 border-amber-200',
          dotClass: 'bg-amber-400',
          Icon: AlertTriangle,
          iconClass: 'text-amber-300',
        }
      : {
          levelKey: 'green' as const,
          labelDa: 'GRØN · S < 0,25',
          containerClass:
            'bg-emerald-950/95 border-emerald-400 text-emerald-100 ring-1 ring-emerald-400/35',
          pillClass: 'bg-emerald-500 text-slate-950 border-emerald-200',
          dotClass: 'bg-emerald-400',
          Icon: ShieldCheck,
          iconClass: 'text-emerald-300',
        };

  const { Icon } = tier;

  return (
    <div
      data-testid="eksponerings-badge"
      data-exposure-tier={tier.levelKey}
      data-sum-quotient={s.toFixed(2)}
      className={`mx-2 mt-2 mb-1 px-2.5 py-1.5 rounded-md border flex flex-wrap items-center justify-between gap-2 font-mono text-xs transition-colors shrink-0 shadow-sm ${tier.containerClass}`}
      title={`Eksponerings-Badge for valgt receptor (${selectedReceptor.receptorCode} — ${selectedReceptor.receptorName}): Sum-kvotient S = ${s.toFixed(2)} [Grøn: S < 0,25 · Amber: 0,25–1,0 · Rød: S ≥ 1,0]`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tier.dotClass}`} />
        <Icon className={`w-3.5 h-3.5 shrink-0 ${tier.iconClass}`} />
        <span className="font-extrabold tracking-tight uppercase text-[10.5px] whitespace-nowrap">
          Eksponerings-Badge:
        </span>
        {allReceptors && allReceptors.length > 0 && onSelectReceptor ? (
          <select
            value={selectedReceptor.receptorId}
            onChange={(e) => onSelectReceptor(e.target.value)}
            aria-label="Vælg receptor til Eksponerings-Badge"
            className="bg-slate-950/85 text-white border border-white/20 rounded px-1.5 py-0.5 text-[10.5px] font-bold max-w-[165px] truncate focus:outline-none cursor-pointer"
          >
            {allReceptors.map((rec) => (
              <option key={rec.receptorId} value={rec.receptorId} className="bg-slate-950 text-white">
                {rec.receptorCode} · {rec.receptorName} (S={rec.sumQuotient.toFixed(2)})
              </option>
            ))}
          </select>
        ) : (
          <span className="font-bold truncate max-w-[165px]">
            {selectedReceptor.receptorCode} · {selectedReceptor.receptorName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={`px-2 py-0.5 rounded border text-[10.5px] font-extrabold tracking-wide ${tier.pillClass}`}
        >
          S = {s.toFixed(2).replace('.', ',')}
        </span>
        <span className="text-[10px] font-bold opacity-95 hidden sm:inline">
          {tier.labelDa}
        </span>
      </div>
    </div>
  );
};
