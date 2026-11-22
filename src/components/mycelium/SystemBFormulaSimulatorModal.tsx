/**
 * @file src/components/mycelium/SystemBFormulaSimulatorModal.tsx
 * @description Modul IV — Interaktiv Biokybernetisk Formelsamling (System B) &
 * Dekonstruktion af System A's Alternative Matematik. Ren TypeScript + SVG (#0B0E17).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calculator, CheckCircle2, RotateCcw, Scale, ShieldAlert, X } from 'lucide-react';

export interface SystemBFormulaSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  liveTrMs?: number;
  liveAi?: number;
  liveGamma?: number;
}

type FormulaTabId = 'collapse' | 'freedom' | 'ashby' | 'autonomy_coercion' | 'quadratic_sybil';

const FORMULA_TABS: Array<{ id: FormulaTabId; title: string }> = [
  { id: 'collapse', title: '1. Kollaps-ligningen' },
  { id: 'freedom', title: '2. Frihedens Ligning' },
  { id: 'ashby', title: '3. Ashbys Lov' },
  { id: 'autonomy_coercion', title: '4. Autonomi vs. Tvang' },
  { id: 'quadratic_sybil', title: '5. Kvadratisk, Sybil & Loss' },
];

const FALC_LABELS = ['Vand & Regnvand', 'Mad & Energi', 'Bolig & Varme', 'Sundhed & HEPA', 'Åben Information'];

const RangeRow: React.FC<{
  label: string; valText: string; valCls?: string; accent?: string;
  min: number; max: number; step?: number; value: number; disabled?: boolean;
  onChange: (v: number) => void;
}> = ({ label, valText, valCls = 'text-cyan-300', accent = 'accent-cyan-400', min, max, step = 1, value, disabled, onChange }) => (
  <label className="block space-y-0.5 text-[11px]">
    <span className="flex justify-between gap-2 text-slate-300">
      <span>{label}</span><strong className={valCls}>{valText}</strong>
    </span>
    <input type="range" min={min} max={max} step={step} disabled={disabled} value={value} onChange={(e) => onChange(Number(e.target.value))} className={`w-full ${accent}`} />
  </label>
);

export const SystemBFormulaSimulatorModal: React.FC<SystemBFormulaSimulatorModalProps> = ({
  isOpen, onClose, liveTrMs = 179, liveAi = 0.86, liveGamma = 0.12,
}) => {
  const [activeTab, setActiveTab] = useState<FormulaTabId>('collapse');
  const [p, setP] = useState(() => ({
    sysAMonths: 9, sysBTrMs: Math.max(40, Math.round(liveTrMs)), deltaTMin: 5,
    automationPct: 68, falcSupplyPct: 74, microGridPct: 80,
    disturbanceVd: 240, localNodeCount: 9, nodeGainVc: 6,
    tokens: 400, sybilPs: 0.15, isBotSwarmInf: false, hasSbt: true,
    threatLevel: 1.8, gammaWeight: Math.max(1, Math.round(liveGamma * 20) || 4),
    sysAPressurePct: 75,
  }));
  const [falcDomains, setFalcDomains] = useState<number[]>([88, 78, 72, 76, 92]);
  const [selectedIllusionIdx, setSelectedIllusionIdx] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleReset = () => {
    setP({
      sysAMonths: 9, sysBTrMs: Math.max(40, Math.round(liveTrMs)), deltaTMin: 5,
      automationPct: 68, falcSupplyPct: 74, microGridPct: 80,
      disturbanceVd: 240, localNodeCount: 9, nodeGainVc: 6,
      tokens: 400, sybilPs: 0.15, isBotSwarmInf: false, hasSbt: true,
      threatLevel: 1.8, gammaWeight: 4, sysAPressurePct: 75,
    });
    setFalcDomains([88, 78, 72, 76, 92]);
  };

  const calc = useMemo(() => {
    const deltaTMs = p.deltaTMin * 60_000;
    const ratioA = (p.sysAMonths * 30 * 24 * 3600 * 1000) / deltaTMs;
    const ratioB = p.sysBTrMs / deltaTMs;
    const growthA = Math.min(0.42, 0.14 + p.sysAMonths * 0.012);
    const curveA = Array.from({ length: 13 }, (_, t) => Math.min(100, 8 * Math.exp(growthA * t)));
    const curveB = Array.from({ length: 13 }, (_, t) => Math.max(0.8, 28 * Math.exp(-1.45 * (t + 1) * Math.max(0.3, 1 - ratioB))));
    const red = (p.automationPct * 0.38 + p.falcSupplyPct * 0.36 + p.microGridPct * 0.26) / 100;
    const bioRestH = 8.0, sysBNecessaryWorkH = Math.max(1.1, 9.6 * (1 - 0.84 * red));
    const sysAFreedomH = 6.4, sysBFreedomH = Math.max(1.0, 24 - bioRestH - sysBNecessaryWorkH);
    const requiredVr = p.disturbanceVd / Math.max(1, p.nodeGainVc), sysAVr = 14, sysBVr = p.localNodeCount * 9.5;
    const falcAvg = falcDomains.reduce((a, b) => a + b, 0) / (falcDomains.length * 100);
    const aiVal = Math.min(1, Math.max(0.05, 0.12 + 0.88 * falcAvg));
    const deltaG = Math.max(0.02, (1 - falcAvg) * 3.2), deltaBnpReal = 0.95 + falcAvg * 0.65;
    const ciVal = deltaG / deltaBnpReal;
    const rawQuadVotes = Math.sqrt(p.tokens);
    const vpVal = !p.hasSbt || p.isBotSwarmInf ? 0 : rawQuadVotes / (1 + p.sybilPs);
    const coercionLoss = p.gammaWeight * Math.pow(p.threatLevel, 2);
    return { deltaTMs, ratioA, ratioB, curveA, curveB, bioRestH, sysBNecessaryWorkH, sysAFreedomH, sysBFreedomH, requiredVr, sysAVr, sysBVr, ashbySatisfied: sysBVr >= requiredVr, falcAvg, aiVal, ciVal, deltaG, deltaBnpReal, rawQuadVotes, vpVal, coercionLoss };
  }, [p, falcDomains]);

  if (!isOpen) return null;

  const illusions = [
    {
      code: 'a', title: 'Tabsgivende Identitets- & Kompleksitetskomprimering',
      formula: `V_R(System A) = ${calc.sysAVr} ≪ V_D = ${p.disturbanceVd}`,
      sysA: `Komprimerer biologiske borgere og lokal økologi til rigide årsgennemsnit i regneark. Taber ${Math.round(Math.max(0, (1 - calc.sysAVr / p.disturbanceVd) * 100))}% af akutte støv-/støjspidser (brud på Ashbys Lov).`,
      sysB: `System 1 Algedonoder måler højopløst S-kvotient pr. blok med Groth16 ZKP (0 KB persondata) og absorberer ${Math.min(100, Math.round((calc.sysBVr / Math.max(1, calc.requiredVr)) * 100))}% varians lokalt.`,
    },
    {
      code: 'b', title: 'Monetær Realabstraktion & Eksternalisering',
      formula: `Bogført Eksternalitet = 0 kr. · Reel Skade = ${(p.sysAPressurePct * 0.42).toFixed(1)} Mkr.-ækv.`,
      sysA: `Asbeststøv (<1997), impulsstøj og grundvandsudvaskning i Ringparken bogføres som 0 kr. eksternalitet, mens sen-oprydning tæller positivt (+${(p.sysAPressurePct * 0.18).toFixed(1)}%) i BNP.`,
      sysB: `Calculation in Kind 2.0 fører uforfalskelig fysisk regnskab i fibre/cm³, dB(A), Joules, kg H₂O og m³/h HEPA — entropi kan aldrig bogføres som vækst.`,
    },
    {
      code: 'c', title: 'Eksponentiel Gældsstiftelse Ex Nihilo',
      formula: `ΔG_sys / ΔBNP_real = ${(1.1 + p.sysAPressurePct * 0.032).toFixed(2)} ⇒ T_nødvendig ↑`,
      sysA: `Kredit skabt ex nihilo vokser hurtigere end realøkonomien (C_i = ${(1.1 + p.sysAPressurePct * 0.032).toFixed(2)}) og låser ${(6.4 + p.sysAPressurePct * 0.045).toFixed(1)} t/døgn af borgerens biologiske levetid.`,
      sysB: `FALC + sol/LFP mikro-grid driver C_i → ${calc.ciVal.toFixed(2)} og A_i → ${calc.aiVal.toFixed(2)}, hvilket frigør ${calc.sysBFreedomH.toFixed(1)} t/døgn suveræn levetid.`,
    },
  ];

  return (
    <div data-testid="system-b-formula-simulator-modal" onClick={onClose} className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 pointer-events-auto">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-lg bg-[#0B0E17] border border-cyan-500/50 shadow-2xl p-4 sm:p-5 text-slate-100 font-mono space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="space-y-0.5">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Modul IV · Biokybernetisk Formelsamling &amp; Dekonstruktion af System A</span>
            </h2>
            <p className="text-[11px] text-slate-400 tabular-nums">Ringparken Live-anker: T_r(Mycelie) = {liveTrMs} ms · ΔT = 300.000 ms (5 min) · Live A_i = {liveAi.toFixed(2)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={handleReset} className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"><RotateCcw className="w-3.5 h-3.5" /><span>Nulstil</span></button>
            <button type="button" data-testid="close-formula-simulator-btn" onClick={onClose} className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-rose-950 border border-slate-700 text-slate-200 text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"><X className="w-3.5 h-3.5" /><span>Luk</span></button>
          </div>
        </div>

        {/* Sektion 1: Interaktiv Beregner for System B's 5 Formler */}
        <section className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5 bg-[#07090E] p-1.5 rounded border border-slate-800">
            {FORMULA_TABS.map((t) => (
              <button key={t.id} type="button" data-testid={`formula-tab-${t.id}`} onClick={() => setActiveTab(t.id)} className={`px-2.5 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${activeTab === t.id ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-900'}`}>
                {t.title}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-[#07090E] border border-slate-800 rounded-md p-3.5 tabular-nums">
            <div className="lg:col-span-5 space-y-2.5">
              {activeTab === 'collapse' && (
                <>
                  <RangeRow label="System A Sagsbehandling (T_r,A)" valText={`${p.sysAMonths} mdr.`} valCls="text-rose-300" accent="accent-rose-500" min={1} max={24} value={p.sysAMonths} onChange={(v) => setP((s) => ({ ...s, sysAMonths: v }))} />
                  <RangeRow label="System B Mycelie P2P (T_r,B)" valText={`${p.sysBTrMs} ms`} min={40} max={2000} step={10} value={p.sysBTrMs} onChange={(v) => setP((s) => ({ ...s, sysBTrMs: v }))} />
                  <RangeRow label="Fysisk Miljø-Deadline (ΔT)" valText={`${p.deltaTMin} min (${calc.deltaTMs.toLocaleString('da-DK')} ms)`} valCls="text-emerald-300" accent="accent-emerald-400" min={1} max={15} value={p.deltaTMin} onChange={(v) => setP((s) => ({ ...s, deltaTMin: v }))} />
                </>
              )}
              {activeTab === 'freedom' && (
                <>
                  <RangeRow label="Automatisering & Robotik" valText={`${p.automationPct} %`} min={0} max={100} value={p.automationPct} onChange={(v) => setP((s) => ({ ...s, automationPct: v }))} />
                  <RangeRow label="FALC Fælleds-Forsyning" valText={`${p.falcSupplyPct} %`} valCls="text-emerald-300" accent="accent-emerald-400" min={0} max={100} value={p.falcSupplyPct} onChange={(v) => setP((s) => ({ ...s, falcSupplyPct: v }))} />
                  <RangeRow label="Lokal Sol/LFP Mikro-Grid" valText={`${p.microGridPct} %`} valCls="text-amber-300" accent="accent-amber-400" min={0} max={100} value={p.microGridPct} onChange={(v) => setP((s) => ({ ...s, microGridPct: v }))} />
                </>
              )}
              {activeTab === 'ashby' && (
                <>
                  <RangeRow label="Miljø- & Social Varians (V_D)" valText={`${p.disturbanceVd} tilstande`} valCls="text-amber-300" accent="accent-amber-400" min={40} max={500} step={10} value={p.disturbanceVd} onChange={(v) => setP((s) => ({ ...s, disturbanceVd: v }))} />
                  <RangeRow label="Aktive System 1 Receptor-Noder" valText={`${p.localNodeCount} noder`} min={1} max={16} value={p.localNodeCount} onChange={(v) => setP((s) => ({ ...s, localNodeCount: v }))} />
                  <RangeRow label="Lokal Dæmpningsfaktor (V_C)" valText={`${p.nodeGainVc}×`} valCls="text-emerald-300" accent="accent-emerald-400" min={1} max={12} value={p.nodeGainVc} onChange={(v) => setP((s) => ({ ...s, nodeGainVc: v }))} />
                </>
              )}
              {activeTab === 'autonomy_coercion' && (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400">Udrulning af FALC pr. livsdomæne (0–100 %):</div>
                  {FALC_LABELS.map((lbl, idx) => (
                    <RangeRow key={lbl} label={lbl} valText={`${falcDomains[idx]} %`} valCls="text-emerald-300" accent="accent-emerald-400" min={0} max={100} value={falcDomains[idx]} onChange={(v) => setFalcDomains((arr) => arr.map((x, i) => (i === idx ? v : x)))} />
                  ))}
                </div>
              )}
              {activeTab === 'quadratic_sybil' && (
                <div className="space-y-2">
                  <RangeRow label="Indsatte Stemme-Tokens (Cost = v²)" valText={`${p.tokens} Tokens`} min={1} max={2500} value={p.tokens} onChange={(v) => setP((s) => ({ ...s, tokens: v }))} />
                  <RangeRow label="Sybil-Mistankescore (P_s)" valText={p.isBotSwarmInf ? '∞ (Bot-Sværm)' : p.sybilPs.toFixed(2)} valCls="text-amber-300" accent="accent-amber-400" min={0} max={20} step={0.05} disabled={p.isBotSwarmInf} value={p.sybilPs} onChange={(v) => setP((s) => ({ ...s, sybilPs: v }))} />
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setP((s) => ({ ...s, hasSbt: !s.hasSbt }))} className={`px-2 py-1 rounded border text-[11px] font-bold cursor-pointer ${p.hasSbt ? 'bg-emerald-950 border-emerald-400 text-emerald-200' : 'bg-rose-950 border-rose-400 text-rose-200'}`}>
                      {p.hasSbt ? '✓ SBT = 1 (ERC-5192)' : '✕ SBT = 0 (Ingen SBT)'}
                    </button>
                    <button type="button" onClick={() => setP((s) => ({ ...s, isBotSwarmInf: !s.isBotSwarmInf }))} className={`px-2 py-1 rounded border text-[11px] font-bold cursor-pointer ${p.isBotSwarmInf ? 'bg-rose-600 border-rose-300 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
                      {p.isBotSwarmInf ? 'Bot-Sværm P_s → ∞ AKTIV' : 'Simulér Bot-Sværm (P_s → ∞)'}
                    </button>
                  </div>
                  <RangeRow label={`Tvangs-Trussel Threat(a_i) · γ=${p.gammaWeight}`} valText={p.threatLevel.toFixed(1)} valCls="text-rose-300" accent="accent-rose-500" min={0} max={5} step={0.1} value={p.threatLevel} onChange={(v) => setP((s) => ({ ...s, threatLevel: v }))} />
                </div>
              )}
            </div>

            <div className="lg:col-span-7 bg-[#0B0E17] border border-slate-800 rounded p-3 space-y-2.5 flex flex-col justify-between">
              {activeTab === 'collapse' && (
                <>
                  <div className="flex flex-wrap justify-between gap-2 text-xs">
                    <span className="font-bold text-cyan-200">T_r / ΔT ⇒ Q(t) → ∞ (når T_r &gt; ΔT)</span>
                    <span className="text-emerald-300">System B: T_r/ΔT = {calc.ratioB.toFixed(5)} ≪ 1</span>
                  </div>
                  <svg viewBox="0 0 420 126" className="w-full h-auto rounded bg-[#05070B] border border-slate-800">
                    <line x1={28} y1={108} x2={406} y2={108} stroke="#334155" strokeWidth={1} />
                    <polyline fill="none" stroke="#f43f5e" strokeWidth={2.5} points={calc.curveA.map((v, i) => `${28 + i * 31},${108 - v * 0.9}`).join(' ')} />
                    <polyline fill="none" stroke="#22d3ee" strokeWidth={2.5} points={calc.curveB.map((v, i) => `${28 + i * 31},${108 - v * 0.9}`).join(' ')} />
                    <text x={34} y={20} className="fill-rose-400 text-[9.5px] font-mono font-bold">▲ System A Sags-/Skadekø Q(t) → ∞ (T_r/ΔT = {Math.round(calc.ratioA).toLocaleString('da-DK')}×)</text>
                    <text x={34} y={99} className="fill-cyan-300 text-[9.5px] font-mono font-bold">● System B P2P Selvheling ({p.sysBTrMs} ms ≪ {p.deltaTMin} min) ⇒ Q → 0</text>
                  </svg>
                  <p className="text-[11px] text-slate-300">Når administrativ klagebehandling ({p.sysAMonths} mdr.) overstiger sprednings-deadlinen ({p.deltaTMin} min), divergerer sags- og helbredsskadekøen Q(t) eksponentielt.</p>
                </>
              )}
              {activeTab === 'freedom' && (
                <>
                  <div className="flex flex-wrap justify-between gap-2 text-xs">
                    <span className="font-bold text-cyan-200">Frihed = T_total (24t) − T_nødvendig</span>
                    <span className="text-emerald-300 font-bold">+{(((calc.sysBFreedomH - calc.sysAFreedomH) * 365) / 24).toFixed(0)} frigjorte døgn/år</span>
                  </div>
                  <div className="space-y-2 text-[11px]">
                    {[
                      { lbl: 'System A (Løn-/Gældstvang: 9,6t)', work: 9.6, free: calc.sysAFreedomH, wCls: 'bg-rose-600/80', fCls: 'bg-cyan-500/50', tCls: 'text-rose-300' },
                      { lbl: `System B (FALC + Mikro-Grid: ${calc.sysBNecessaryWorkH.toFixed(1)}t)`, work: calc.sysBNecessaryWorkH, free: calc.sysBFreedomH, wCls: 'bg-amber-500/80', fCls: 'bg-emerald-500/85', tCls: 'text-emerald-300' },
                    ].map((row) => (
                      <div key={row.lbl}>
                        <div className="flex justify-between text-slate-300 mb-1"><span>{row.lbl}</span><strong className={row.tCls}>Frihed: {row.free.toFixed(1)} t/døgn</strong></div>
                        <div className="h-5 w-full rounded bg-slate-900 overflow-hidden flex border border-slate-800">
                          <div style={{ width: `${(8 / 24) * 100}%` }} className="bg-slate-700" />
                          <div style={{ width: `${(row.work / 24) * 100}%` }} className={row.wCls} />
                          <div style={{ width: `${(row.free / 24) * 100}%` }} className={row.fCls} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-300">Automatisering, FALC og lokal mikro-grid sænker T_nødvendig til {calc.sysBNecessaryWorkH.toFixed(1)} t/døgn og frigør biologisk levetid.</p>
                </>
              )}
              {activeTab === 'ashby' && (
                <>
                  <div className="flex flex-wrap justify-between gap-2 text-xs">
                    <span className="font-bold text-cyan-200">Ashbys Lov: V_R ≥ V_D / V_C (Krav: ≥ {calc.requiredVr.toFixed(1)})</span>
                    <span className={calc.ashbySatisfied ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>{calc.ashbySatisfied ? '● HOMEOSTASE OPFYLDT' : '▲ TILFØJ FLERE S1-NODER'}</span>
                  </div>
                  <div className="space-y-2 text-[11px]">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between"><span>System A Central Flaskehals (V_R = {calc.sysAVr})</span><strong className="text-rose-400">Uabsorberet varians: {Math.max(0, calc.requiredVr - calc.sysAVr).toFixed(1)}</strong></div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between"><span>System B Decentralt Mycelie ({p.localNodeCount} noder ⇒ V_R = {calc.sysBVr.toFixed(1)})</span><strong className={calc.ashbySatisfied ? 'text-emerald-300' : 'text-amber-300'}>Margin: {(calc.sysBVr - calc.requiredVr).toFixed(1)}</strong></div>
                  </div>
                  <p className="text-[11px] text-slate-300">Decentral uddelegering til Ringparkens System 1-noder absorberer miljømæssig og social varians (V_D) ved kilden uden central flaskehals.</p>
                </>
              )}
              {activeTab === 'autonomy_coercion' && (
                <>
                  <div className="text-xs font-bold text-cyan-200">A_i = V_lokal / V_total → 1,0 vs. C_i = ΔG_systemisk / ΔBNP_real → 0,0</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-2.5 rounded bg-slate-900 border border-emerald-500/40 space-y-1.5">
                      <div className="flex justify-between text-xs"><span>Autonomi-indeks (A_i)</span><strong className="text-emerald-300">{calc.aiVal.toFixed(2)} / 1,00</strong></div>
                      <div className="h-3 rounded bg-slate-950 overflow-hidden"><div style={{ width: `${calc.aiVal * 100}%` }} className="h-full bg-emerald-400" /></div>
                      <div className="text-[11px] text-slate-400">{calc.aiVal >= 0.85 ? '● Fuld suveræn Island Mode' : 'Udbyg FALC for fuld Ø-drift'}</div>
                    </div>
                    <div className="p-2.5 rounded bg-slate-900 border border-rose-500/40 space-y-1.5">
                      <div className="flex justify-between text-xs"><span>Tvangs-indeks (C_i)</span><strong className="text-rose-300">{calc.ciVal.toFixed(2)} → 0,00</strong></div>
                      <div className="h-3 rounded bg-slate-950 overflow-hidden"><div style={{ width: `${Math.min(100, (calc.ciVal / 3.4) * 100)}%` }} className="h-full bg-rose-500" /></div>
                      <div className="text-[11px] text-slate-400">ΔG_sys={calc.deltaG.toFixed(2)} / ΔBNP_real={calc.deltaBnpReal.toFixed(2)}</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-300">FALC-udrulning ({(calc.falcAvg * 100).toFixed(0)} %) driver C_i mod 0,00 og A_i mod 1,00 (suveræn Island Mode).</p>
                </>
              )}
              {activeTab === 'quadratic_sybil' && (
                <>
                  <div className="text-xs font-bold text-cyan-200">Cost = v² · V_p = √Tokens / (1 + P_s) · Loss_coercion = γ · Threat(a_i)²</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800"><div className="text-[11px] text-slate-400">Rå v = √Tokens</div><div className="text-sm font-bold text-cyan-300">{calc.rawQuadVotes.toFixed(2)}</div><div className="text-[11px] text-slate-500">Cost = {p.tokens}</div></div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800"><div className="text-[11px] text-slate-400">Sybil-vægt V_p</div><div className={`text-sm font-bold ${calc.vpVal === 0 ? 'text-rose-400' : 'text-emerald-300'}`}>{calc.vpVal.toFixed(3)}</div><div className="text-[11px] text-slate-500">{!p.hasSbt ? 'Blokeret: SBT=0' : p.isBotSwarmInf ? 'Blokeret: P_s→∞' : '√T / (1 + P_s)'}</div></div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800"><div className="text-[11px] text-slate-400">Loss_coercion</div><div className={`text-sm font-bold ${calc.coercionLoss > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{calc.coercionLoss.toFixed(2)}</div><div className="text-[11px] text-slate-500">γ · Threat(a_i)²</div></div>
                  </div>
                  <p className="text-[11px] text-slate-300">Bot-sværme (P_s → ∞) og aktører uden uoverdragelig SBT (SBT = 0) får V_p = 0. Anti-Coercion Loss ({calc.coercionLoss.toFixed(2)}) tvinger lokale modeller til frivilligt samarbejde (Threat = 0).</p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Sektion 2: Dekonstruktion af System A's Alternative Matematik */}
        <section className="rounded-md bg-[#07090E] border border-slate-800 p-3.5 space-y-3 tabular-nums">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-200"><Scale className="w-4 h-4 text-amber-400 shrink-0" /><span>Dekonstruktion af System A&apos;s Tre Regnetekniske Illusioner</span></div>
            <label className="flex items-center gap-2 text-[11px] text-slate-300">
              <span>System A Eksternaliserings- &amp; Gældspres:</span>
              <input type="range" min={20} max={100} value={p.sysAPressurePct} onChange={(e) => setP((s) => ({ ...s, sysAPressurePct: Number(e.target.value) }))} className="w-28 accent-amber-400" />
              <strong className="text-amber-300 w-9 text-right">{p.sysAPressurePct}%</strong>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {illusions.map((item, idx) => (
              <div key={item.code} onClick={() => setSelectedIllusionIdx(idx)} className={`rounded p-3 border transition-colors cursor-pointer space-y-2 ${selectedIllusionIdx === idx ? 'bg-[#0B0E17] border-amber-400/80' : 'bg-[#0B0E17]/70 border-slate-800 hover:border-slate-700'}`}>
                <div className="text-xs font-bold text-white">{item.code}) {item.title}</div>
                <div className="text-[11px] text-amber-300 font-bold">{item.formula}</div>
                <div className="text-[11px] text-rose-200/95 flex items-start gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" /><span><strong>System A:</strong> {item.sysA}</span></div>
                <div className="text-[11px] text-emerald-200/95 flex items-start gap-1.5 pt-1 border-t border-slate-800/90"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" /><span><strong>System B:</strong> {item.sysB}</span></div>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" /><span>Aktiv sammenligning ({illusions[selectedIllusionIdx].code}): System A skjuler fysisk entropi i monetære gennemsnit, mens System B måler og dæmper den i realtid.</span></div>
        </section>
      </div>
    </div>
  );
};
