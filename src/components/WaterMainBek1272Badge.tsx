import React from 'react';
import { AlertOctagon, AlertTriangle, ShieldCheck } from 'lucide-react';
import { WaterMainLiveTelemetry } from '../types/dispersion';

export interface WaterMainBek1272BadgeProps {
  telemetry: WaterMainLiveTelemetry | null | undefined;
  visible?: boolean;
  variant?: 'compact' | 'detailed';
  testId?: string;
}

type ComplianceTier = 'nominal' | 'warning' | 'critical';

interface SubstanceCompliance {
  key: 'pb' | 'pah' | 'pcb';
  label: string;
  valueText: string;
  limitText: string;
  tier: ComplianceTier;
  statusWord: string;
}

function resolveTierStyle(tier: ComplianceTier) {
  if (tier === 'critical') {
    return {
      container: 'bg-rose-950/95 border-rose-400 text-rose-100',
      text: 'text-rose-200',
      symbol: '✖',
      Icon: AlertOctagon,
      iconClass: 'text-rose-300',
      badgeLabel: 'BEK 1272/2025: OVERSKRIDELSE',
    };
  }
  if (tier === 'warning') {
    return {
      container: 'bg-amber-950/95 border-amber-400 text-amber-100',
      text: 'text-amber-200',
      symbol: '▲',
      Icon: AlertTriangle,
      iconClass: 'text-amber-300',
      badgeLabel: 'BEK 1272/2025: SKÆRPET OPSYN',
    };
  }
  return {
    container: 'bg-emerald-950/95 border-emerald-400 text-emerald-100',
    text: 'text-emerald-200',
    symbol: '●',
    Icon: ShieldCheck,
    iconClass: 'text-emerald-300',
    badgeLabel: 'BEK 1272/2025: OVERHOLDT',
  };
}

export const WaterMainBek1272Badge: React.FC<WaterMainBek1272BadgeProps> = ({
  telemetry,
  visible = true,
  variant = 'compact',
  testId = 'water-main-bek1272-badge',
}) => {
  if (!visible || !telemetry) {
    return null;
  }

  const pbUgL = telemetry.estimatedLeadIntrusionUgL;
  const pah4UgL = telemetry.estimatedPah4SumUgL;
  const pcbUgL = telemetry.estimatedPcbIntrusionUgL ?? 0.08;
  const backsiphonageActive = telemetry.intrusionRiskLevel === 'active_backsiphonage';

  const pbTier: ComplianceTier =
    pbUgL > 5.0 || backsiphonageActive ? 'critical' : pbUgL >= 3.0 ? 'warning' : 'nominal';
  const pahTier: ComplianceTier =
    pah4UgL > 0.1 || backsiphonageActive ? 'critical' : pah4UgL >= 0.06 ? 'warning' : 'nominal';
  const pcbTier: ComplianceTier =
    pcbUgL > 0.5 || backsiphonageActive ? 'critical' : pcbUgL >= 0.3 ? 'warning' : 'nominal';

  const overallTier: ComplianceTier =
    pbTier === 'critical' || pahTier === 'critical' || pcbTier === 'critical'
      ? 'critical'
      : pbTier === 'warning' ||
        pahTier === 'warning' ||
        pcbTier === 'warning' ||
        telemetry.intrusionRiskLevel === 'high' ||
        telemetry.intrusionRiskLevel === 'moderate'
      ? 'warning'
      : 'nominal';

  const overallStyle = resolveTierStyle(overallTier);
  const OverallIcon = overallStyle.Icon;

  const substances: SubstanceCompliance[] = [
    {
      key: 'pb',
      label: 'Bly (Pb)',
      valueText: `${pbUgL.toFixed(2)}`,
      limitText: '≤5,0',
      tier: pbTier,
      statusWord: pbTier === 'critical' ? 'OVERSKR.' : pbTier === 'warning' ? 'OPSYN' : 'OK',
    },
    {
      key: 'pah',
      label: 'PAH (4-sum)',
      valueText: `${pah4UgL.toFixed(3)}`,
      limitText: '≤0,10',
      tier: pahTier,
      statusWord: pahTier === 'critical' ? 'OVERSKR.' : pahTier === 'warning' ? 'OPSYN' : 'OK',
    },
    {
      key: 'pcb',
      label: 'PCB',
      valueText: `${pcbUgL.toFixed(2)}`,
      limitText: '≤0,50',
      tier: pcbTier,
      statusWord: pcbTier === 'critical' ? 'OVERSKR.' : pcbTier === 'warning' ? 'OPSYN' : 'OK',
    },
  ];

  if (variant === 'compact') {
    return (
      <div
        data-testid={testId}
        role="status"
        aria-label={`BEK 1272/2025 drikkevandsstatus: Bly ${pbUgL.toFixed(2)} µg/L, PAH ${pah4UgL.toFixed(3)} µg/L, PCB ${pcbUgL.toFixed(2)} µg/L`}
        className={`px-2 py-0.5 rounded border font-mono text-[11px] font-bold shadow-md flex items-center gap-1.5 tabular-nums whitespace-nowrap ${overallStyle.container}`}
      >
        <OverallIcon className={`w-3 h-3 shrink-0 ${overallStyle.iconClass}`} aria-hidden="true" />
        <span>{overallStyle.badgeLabel}</span>
        <span aria-hidden="true" className="opacity-60">
          ·
        </span>
        <span>
          Bly {pbUgL.toFixed(2)} · PAH {pah4UgL.toFixed(3)} · PCB {pcbUgL.toFixed(2)} µg/L
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      role="status"
      aria-label={`BEK 1272/2025 compliance for Bly, PAH og PCB: ${overallStyle.badgeLabel}`}
      className={`rounded border px-2 py-1.5 font-mono text-[11px] tabular-nums space-y-1 ${overallStyle.container}`}
    >
      <div className="flex items-center justify-between gap-2 font-bold">
        <span className="inline-flex items-center gap-1.5">
          <OverallIcon className={`w-3.5 h-3.5 shrink-0 ${overallStyle.iconClass}`} aria-hidden="true" />
          <span>{overallStyle.badgeLabel}</span>
        </span>
        <span className="opacity-80 font-normal">µg/L (VFL § 62)</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px]">
        {substances.map((sub, idx) => {
          const subStyle = resolveTierStyle(sub.tier);
          return (
            <React.Fragment key={sub.key}>
              {idx > 0 && (
                <span aria-hidden="true" className="opacity-40">
                  ·
                </span>
              )}
              <span className={`inline-flex items-center gap-1 ${subStyle.text}`}>
                <span aria-hidden="true">{subStyle.symbol}</span>
                <span className="font-semibold">{sub.label}:</span>
                <span className="font-bold">{sub.valueText}</span>
                <span className="opacity-75">
                  ({sub.limitText} · {sub.statusWord})
                </span>
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
